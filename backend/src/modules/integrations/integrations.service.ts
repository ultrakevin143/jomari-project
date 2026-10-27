import { Prisma, type PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { audit, type AuditInput } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import { stableHash } from "../../shared/hash.js";
import {
  pageResponse,
  paginate,
  paging,
  uuid,
} from "../../shared/validation.js";
import { permittedEntities } from "../canonical/canonical.policy.js";
import { entitySchema } from "../canonical/canonical.schemas.js";
import { saveCanonical } from "../canonical/canonical.service.js";
import {
  integrationErrorStatusSchema,
  integrationRunStatusFilterSchema,
  importSchema,
  retryCorrectionsSchema,
} from "./integrations.schemas.js";
import { mockRecords } from "./mock.adapter.js";

import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
export async function sourceLock<T>(
  db: PrismaClient,
  organizationId: string,
  sourceSystemId: string,
  work: () => Promise<T>,
) {
  const leaseExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await db.integrationLock.deleteMany({
    where: { sourceSystemId, organizationId, expiresAt: { lt: new Date() } },
  });
  try {
    await db.integrationLock.create({
      data: {
        sourceSystemId,
        organizationId,
        expiresAt: leaseExpiry,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ApiError(
        409,
        "SOURCE_BUSY",
        "This source has an active import. Wait for it to finish.",
      );
    throw e;
  }
  try {
    return await work();
  } finally {
    await db.integrationLock.deleteMany({
      where: { sourceSystemId, organizationId, expiresAt: leaseExpiry },
    });
  }
}
export function safeIssue(e: unknown) {
  if (e instanceof z.ZodError)
    return e.issues
      .map((i) => `${i.path.join(".") || "record"}: ${i.message}`)
      .join("; ")
      .slice(0, 1800);
  if (e instanceof ApiError) return e.message;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002")
      return "A natural identifier conflicts with an existing record (registration, ticket number, or source ID).";
    if (e.code === "P2003")
      return "A referenced canonical record no longer exists.";
  }
  throw e;
}
export async function executeImport(
  db: PrismaClient,
  input: z.infer<typeof importSchema>,
  context: Omit<AuditInput, "action" | "entity">,
) {
  const source = await db.sourceSystem.findFirst({
    where: { id: input.sourceSystemId, organizationId: context.organizationId },
    include: { connections: true },
  });
  if (!source) throw new ApiError(404, "NOT_FOUND", "Source system not found.");
  const adapter = input.format === "mock" ? "mock" : "csv";
  if (!source.connections.some((c) => c.enabled && c.adapter === adapter))
    throw new ApiError(
      409,
      "SOURCE_DISABLED",
      "The selected source adapter is disabled.",
    );
  const entity = input.entity ?? entitySchema.parse(source.entity);
  if (!permittedEntities[source.entity]?.includes(entity))
    throw new ApiError(
      422,
      "ENTITY_MISMATCH",
      "The selected entity is not owned by this source.",
    );
  let rows: Prisma.InputJsonObject[] = [];
  if (input.format === "csv") {
    if (!input.csv)
      throw new ApiError(
        422,
        "EMPTY_IMPORT",
        "Provide a CSV header and at least one record.",
      );
    try {
      rows = parse(input.csv, {
        columns: (headers: string[]) => {
          if (
            headers.some((h) => !h || !/^[A-Za-z][A-Za-z0-9_]*$/.test(h)) ||
            new Set(headers).size !== headers.length
          )
            throw new Error(
              "CSV column names must be unique canonical field names.",
            );
          return headers;
        },
        skip_empty_lines: true,
        bom: true,
        trim: true,
        max_record_size: 64000,
        relax_column_count: false,
      }) as Record<string, string>[];
    } catch {
      throw new ApiError(
        422,
        "INVALID_CSV",
        "CSV could not be parsed. Check matching columns, quoted fields, and headers.",
      );
    }
  } else if (input.format === "json") rows = input.records ?? [];
  else rows = await mockRecords(db, context.organizationId, entity);
  if (rows.length === 0 || rows.length > 500)
    throw new ApiError(
      422,
      "IMPORT_SIZE",
      "Import between 1 and 500 records per run.",
    );
  const hash = stableHash({ entity, rows });
  const key = {
    organizationId_sourceSystemId_idempotencyKey: {
      organizationId: context.organizationId,
      sourceSystemId: source.id,
      idempotencyKey: input.idempotencyKey,
    },
  };
  const previous = await db.integrationRun.findUnique({ where: key });
  if (previous) {
    if (previous.payloadHash !== hash)
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This key was already used with different content.",
      );
    return { ...previous, replayed: true };
  }
  return sourceLock(db, context.organizationId, source.id, async () => {
    const previous = await db.integrationRun.findUnique({ where: key });
    if (previous) {
      if (previous.payloadHash !== hash)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This key was already used with different content.",
        );
      return { ...previous, replayed: true };
    }
    const run = await db.$transaction(async (tx) => {
      const created = await tx.integrationRun.create({
        data: {
          organizationId: context.organizationId,
          sourceSystemId: source.id,
          idempotencyKey: input.idempotencyKey,
          payloadHash: hash,
          entity,
          method: input.format,
          totalRecords: rows.length,
          initiatedBy: context.actorName,
        },
      });
      await audit(tx, {
        ...context,
        action: "IMPORT_STARTED",
        entity: "integration-run",
        entityId: created.id,
        metadata: { records: rows.length, source: source.code },
      });
      return created;
    });
    let processed = 0,
      failed = 0,
      skipped = 0;
    const seen = new Set<string>();
    try {
      for (const [index, payload] of rows.entries()) {
        const sourceRecordId =
          typeof payload.sourceRecordId === "string"
            ? payload.sourceRecordId.trim()
            : null;
        const raw = await db.rawImportRecord.create({
          data: {
            organizationId: context.organizationId,
            runId: run.id,
            rowNumber: index + 1,
            sourceRecordId,
            payload: payload as Prisma.InputJsonObject,
            payloadHash: stableHash(payload),
            status: "PENDING",
          },
        });
        try {
          if (sourceRecordId && seen.has(sourceRecordId))
            throw new ApiError(
              422,
              "DUPLICATE_SOURCE_RECORD",
              "Source record ID occurs more than once in this file.",
            );
          if (sourceRecordId) seen.add(sourceRecordId);
          const saved = await db.$transaction(async (tx) => {
            const result = await saveCanonical(tx, entity, payload, {
              organizationId: context.organizationId,
              sourceSystemId: source.id,
              sourceVersion: raw.payloadHash,
            });
            await tx.rawImportRecord.update({
              where: { id: raw.id },
              data: {
                status: result.skipped ? "SKIPPED" : "LOADED",
                canonicalId: result.id,
              },
            });
            return result;
          });
          if (saved.skipped) skipped++;
          else processed++;
        } catch (e) {
          const message = safeIssue(e);
          failed++;
          await db.$transaction([
            db.rawImportRecord.update({
              where: { id: raw.id },
              data: { status: "QUARANTINED" },
            }),
            db.integrationRecordError.create({
              data: {
                organizationId: context.organizationId,
                runId: run.id,
                rawRecordId: raw.id,
                code: e instanceof ApiError ? e.code : "VALIDATION_FAILED",
                message,
              },
            }),
          ]);
        }
      }
      return await finishRun(
        db,
        run.id,
        source.id,
        { processed, failed, skipped },
        context,
        "IMPORT_COMPLETED",
      );
    } catch (e) {
      await db.$transaction(async (tx) => {
        await tx.integrationRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            processed,
            failed,
            skipped,
          },
        });
        await audit(tx, {
          ...context,
          action: "IMPORT_FAILED",
          entity: "integration-run",
          entityId: run.id,
          metadata: { processed, failed, skipped },
        });
      });
      throw e;
    }
  });
}
export async function finishRun(
  db: PrismaClient,
  id: string,
  sourceSystemId: string,
  counts: {
    processed: number;
    failed: number;
    skipped: number;
  },
  context: Omit<AuditInput, "action" | "entity">,
  action: string,
) {
  const status =
    counts.failed === 0
      ? "SUCCEEDED"
      : counts.processed + counts.skipped > 0
        ? "PARTIAL"
        : "FAILED";
  return db.$transaction(async (tx) => {
    const run = await tx.integrationRun.update({
      where: { id },
      data: { ...counts, status, finishedAt: new Date() },
    });
    if (status === "SUCCEEDED")
      await tx.sourceSystem.update({
        where: { id: sourceSystemId },
        data: { lastSuccessAt: new Date(), cursor: run.id },
      });
    await audit(tx, {
      ...context,
      action,
      entity: "integration-run",
      entityId: id,
      metadata: { ...counts, status },
    });
    return run;
  });
}
export async function retryImport(
  db: PrismaClient,
  id: string,
  corrections: {
    errorId: string;
    payload: Record<string, Prisma.JsonValue>;
  }[],
  context: Omit<AuditInput, "action" | "entity">,
) {
  const candidateRun = await db.integrationRun.findFirst({
    where: { id, organizationId: context.organizationId },
    include: {
      errors: {
        where: { remediation: { not: "RESOLVED" } },
        include: { rawRecord: true },
      },
    },
  });
  if (!candidateRun)
    throw new ApiError(404, "NOT_FOUND", "Integration run not found.");
  if (candidateRun.status === "RUNNING")
    throw new ApiError(409, "RUN_ACTIVE", "This run is still active.");
  if (
    corrections.some(
      (c) => !candidateRun.errors.some((e) => e.id === c.errorId),
    )
  )
    throw new ApiError(
      422,
      "INVALID_CORRECTION",
      "A correction must belong to an unresolved error in this run.",
    );
  return sourceLock(
    db,
    context.organizationId,
    candidateRun.sourceSystemId,
    async () => {
      // Re-read under the source lease: a preceding retry may have resolved rows.
      const run = await db.integrationRun.findFirst({
        where: { id, organizationId: context.organizationId },
        include: {
          errors: {
            where: { remediation: { not: "RESOLVED" } },
            include: { rawRecord: true },
          },
        },
      });
      if (!run)
        throw new ApiError(404, "NOT_FOUND", "Integration run not found.");
      if (run.status === "RUNNING")
        throw new ApiError(409, "RUN_ACTIVE", "This run is still active.");
      if (corrections.some((c) => !run.errors.some((e) => e.id === c.errorId)))
        throw new ApiError(
          422,
          "INVALID_CORRECTION",
          "A correction must belong to an unresolved error in this run.",
        );
      let { processed, failed, skipped } = run;
      const selection = corrections.length
        ? run.errors.filter((e) => corrections.some((c) => c.errorId === e.id))
        : run.errors;
      for (const error of selection) {
        const payload =
          corrections.find((c) => c.errorId === error.id)?.payload ??
          error.rawRecord.payload;
        try {
          const result = await db.$transaction(async (tx) => {
            const candidate =
              payload && typeof payload === "object" && !Array.isArray(payload)
                ? (payload as Record<string, Prisma.JsonValue>)
                : {};
            const candidateId =
              typeof candidate.sourceRecordId === "string"
                ? candidate.sourceRecordId.trim()
                : null;
            if (
              candidateId &&
              (await tx.rawImportRecord.findFirst({
                where: {
                  runId: id,
                  id: { not: error.rawRecordId },
                  sourceRecordId: candidateId,
                  status: { in: ["LOADED", "SKIPPED"] },
                },
              }))
            )
              throw new ApiError(
                422,
                "DUPLICATE_SOURCE_RECORD",
                "This source ID already has a successful row in this run. Correct the ID before retrying.",
              );
            const saved = await saveCanonical(
              tx,
              entitySchema.parse(run.entity),
              payload,
              {
                organizationId: context.organizationId,
                sourceSystemId: run.sourceSystemId,
                sourceVersion: stableHash(payload),
              },
            );
            await tx.rawImportRecord.update({
              where: { id: error.rawRecordId },
              data: {
                payload: payload as Prisma.InputJsonObject,
                payloadHash: stableHash(payload),
                sourceRecordId: candidateId,
                status: saved.skipped ? "SKIPPED" : "LOADED",
                canonicalId: saved.id,
              },
            });
            await tx.integrationRecordError.update({
              where: { id: error.id },
              data: {
                remediation: "RESOLVED",
                resolvedAt: new Date(),
                attempts: { increment: 1 },
              },
            });
            await audit(tx, {
              ...context,
              action: "IMPORT_RECORD_RETRIED",
              entity: "import-record",
              entityId: error.rawRecordId,
              reason: "Corrected or replayed quarantined record",
              metadata: { runId: id, errorId: error.id },
            });
            return saved;
          });
          if (result.skipped) skipped++;
          else processed++;
          failed--;
        } catch (e) {
          await db.integrationRecordError.update({
            where: { id: error.id },
            data: { message: safeIssue(e), attempts: { increment: 1 } },
          });
        }
      }
      return finishRun(
        db,
        id,
        run.sourceSystemId,
        { processed, failed, skipped },
        context,
        "IMPORT_RETRIED",
      );
    },
  );
}
export function createIntegrationsService(db: PrismaClient) {
  const getSources = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return {
      data: await db.sourceSystem.findMany({
        where: {
          organizationId: requireIdentity(requestContext.user).organizationId,
        },
        orderBy: { name: "asc" },
        include: {
          runs: { orderBy: { startedAt: "desc" }, take: 1 },
          connections: true,
        },
      }),
    };
  };
  const getRuns = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const q = paging.parse(requestInput.query),
      organizationId = requireIdentity(requestContext.user).organizationId;
    const status = integrationRunStatusFilterSchema.parse(q.status);
    const where: Prisma.IntegrationRunWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(q.search
        ? {
            sourceSystem: { name: { contains: q.search, mode: "insensitive" } },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.integrationRun.findMany({
        where,
        ...paginate(q.page, q.pageSize),
        orderBy: { startedAt: q.sort },
        include: { sourceSystem: { select: { name: true, code: true } } },
      }),
      db.integrationRun.count({ where }),
    ]);
    return pageResponse(rows, total, q.page, q.pageSize);
  };
  const getRunsId = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const id = uuid.parse(requestInput.params.id);
    const data = await db.integrationRun.findFirst({
      where: {
        id,
        organizationId: requireIdentity(requestContext.user).organizationId,
      },
      include: {
        sourceSystem: true,
        errors: {
          orderBy: { createdAt: "asc" },
          include: {
            rawRecord: {
              select: { rowNumber: true, payload: true, sourceRecordId: true },
            },
          },
        },
      },
    });
    if (!data) throw new ApiError(404, "NOT_FOUND", "Run not found.");
    return { data };
  };
  const getErrors = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const q = paging.parse(requestInput.query),
      where: Prisma.IntegrationRecordErrorWhereInput = {
        organizationId: requireIdentity(requestContext.user).organizationId,
        ...(q.status
          ? {
              remediation: integrationErrorStatusSchema.parse(q.status),
            }
          : {}),
      };
    const [data, total] = await Promise.all([
      db.integrationRecordError.findMany({
        where,
        ...paginate(q.page, q.pageSize),
        orderBy: { createdAt: q.sort },
        include: {
          rawRecord: { select: { rowNumber: true, sourceRecordId: true } },
          run: { select: { sourceSystem: { select: { name: true } } } },
        },
      }),
      db.integrationRecordError.count({ where }),
    ]);
    return pageResponse(data, total, q.page, q.pageSize);
  };
  const postImports = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return {
      data: await executeImport(
        db,
        importSchema.parse(requestInput.body),
        serviceAudit(requestContext.audit),
      ),
    };
  };
  const postRunsIdRetry = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const id = uuid.parse(requestInput.params.id);
    const body = retryCorrectionsSchema.parse(requestInput.body ?? {});
    return {
      data: await retryImport(
        db,
        id,
        body.corrections,
        serviceAudit(requestContext.audit),
      ),
    };
  };
  return {
    getSources,
    getRuns,
    getRunsId,
    getErrors,
    postImports,
    postRunsIdRetry,
  };
}
