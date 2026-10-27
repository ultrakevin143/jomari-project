import type { Prisma, PrismaClient } from "@prisma/client";
import { audit, type AuditInput } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import {
  pageResponse,
  paginate,
  paging,
  uuid,
} from "../../shared/validation.js";
import { domainScores, evaluateRule, qualityScore } from "./quality.engine.js";
import { snapshot } from "./quality.repository.js";
import {
  qualitySeverityFilterSchema,
  updateRemediationSchema,
  startQualityRunSchema,
} from "./quality.schemas.js";

import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
export async function executeQuality(
  db: PrismaClient,
  context: Omit<AuditInput, "action" | "entity">,
) {
  const run = await db.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<
      {
        locked: boolean;
      }[]
    >`SELECT pg_try_advisory_xact_lock(hashtext('waste-hub-quality'), hashtext(${context.organizationId})) AS locked`;
    if (!lock?.locked)
      throw new ApiError(
        409,
        "QUALITY_BUSY",
        "A quality run is already starting.",
      );
    const busy = await tx.dQRun.findFirst({
      where: {
        organizationId: context.organizationId,
        status: "RUNNING",
        startedAt: { gt: new Date(Date.now() - 600000) },
      },
    });
    if (busy)
      throw new ApiError(
        409,
        "QUALITY_BUSY",
        "A quality run is already active.",
      );
    const created = await tx.dQRun.create({
      data: {
        organizationId: context.organizationId,
        initiatedBy: context.actorName,
      },
    });
    await audit(tx, {
      ...context,
      action: "DQ_STARTED",
      entity: "dq-run",
      entityId: created.id,
    });
    return created;
  });
  try {
    // One bounded snapshot per explicit run; rules reuse it without per-row queries.
    const [data, rules] = await db.$transaction(
      (tx) =>
        Promise.all([
          snapshot(tx, context.organizationId),
          tx.dQRule.findMany({
            where: { organizationId: context.organizationId, active: true },
            orderBy: { code: "asc" },
          }),
        ]),
      { isolationLevel: "RepeatableRead", timeout: 30000 },
    );
    const results = rules.map((rule) => ({
      rule,
      outcome: evaluateRule(
        rule.checkId,
        data,
        rule.config as Record<string, unknown>,
      ),
    }));
    const checked = results.reduce((n, r) => n + r.outcome.checked, 0),
      failed = results.reduce((n, r) => n + r.outcome.failed, 0),
      score = qualityScore(checked, failed);
    return await db.$transaction(async (tx) => {
      await tx.dQResult.createMany({
        data: results.map(({ rule, outcome }) => ({
          organizationId: context.organizationId,
          runId: run.id,
          ruleId: rule.id,
          severity: rule.severity,
          ...outcome,
          samples: outcome.samples as Prisma.InputJsonValue,
          passed: outcome.failed === 0,
          remediation: outcome.failed === 0 ? "RESOLVED" : "OPEN",
        })),
      });
      const saved = await tx.dQRun.update({
        where: { id: run.id },
        data: {
          score,
          checked,
          failed,
          finishedAt: new Date(),
          status: failed ? "PARTIAL" : "SUCCEEDED",
        },
      });
      await audit(tx, {
        ...context,
        action: "DQ_EXECUTED",
        entity: "dq-run",
        entityId: run.id,
        metadata: { score, checked, failed, rules: rules.length },
      });
      return saved;
    });
  } catch (e) {
    await db.$transaction(async (tx) => {
      await tx.dQRun.update({
        where: { id: run.id },
        data: { status: "FAILED", finishedAt: new Date() },
      });
      await audit(tx, {
        ...context,
        action: "DQ_FAILED",
        entity: "dq-run",
        entityId: run.id,
        metadata: {
          errorType: e instanceof ApiError ? e.code : "EXECUTION_FAILED",
        },
      });
    });
    throw e;
  }
}
export function createQualityService(db: PrismaClient) {
  const getRules = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return {
      data: await db.dQRule.findMany({
        where: {
          organizationId: requireIdentity(requestContext.user).organizationId,
        },
        orderBy: { code: "asc" },
      }),
    };
  };
  const getRuns = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const q = paging.parse(requestInput.query),
      where = {
        organizationId: requireIdentity(requestContext.user).organizationId,
      };
    const [data, total] = await Promise.all([
      db.dQRun.findMany({
        where,
        orderBy: { startedAt: q.sort },
        ...paginate(q.page, q.pageSize),
      }),
      db.dQRun.count({ where }),
    ]);
    return pageResponse(data, total, q.page, q.pageSize);
  };
  const getScorecards = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const runId = uuid.optional().parse(requestInput.query.runId);
    const severity = qualitySeverityFilterSchema.parse(
      requestInput.query.severity,
    );
    const run = await db.dQRun.findFirst({
      where: {
        organizationId: requireIdentity(requestContext.user).organizationId,
        ...(runId ? { id: runId } : {}),
        finishedAt: { not: null },
        status: { not: "FAILED" },
      },
      orderBy: { startedAt: "desc" },
      include: {
        results: { include: { rule: true }, orderBy: { failed: "desc" } },
      },
    });
    return {
      data: run
        ? {
            ...run,
            domains: domainScores(run.results),
            results: run.results.filter(
              (r) => !severity || r.severity === severity,
            ),
            formula:
              "100 × (checks − failed checks) / checks; each record-rule pair counts once. No checks = 100; inspect sample size. Remediation labels do not change the score.",
          }
        : null,
    };
  };
  const postRuns = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    startQualityRunSchema.parse(requestInput.body ?? {});
    return {
      data: await executeQuality(db, serviceAudit(requestContext.audit)),
    };
  };
  const patchResultsId = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const id = uuid.parse(requestInput.params.id),
      body = updateRemediationSchema.parse(requestInput.body);
    const result = await db.dQResult.findFirst({
      where: {
        id,
        organizationId: requireIdentity(requestContext.user).organizationId,
      },
    });
    if (!result)
      throw new ApiError(404, "NOT_FOUND", "Quality result not found.");
    const data = await db.$transaction(async (tx) => {
      const saved = await tx.dQResult.update({
        where: { id },
        data: { remediation: body.remediation, remediationNote: body.note },
      });
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "DQ_REMEDIATION_CHANGED",
        entity: "dq-result",
        entityId: id,
        reason: body.note,
        metadata: { from: result.remediation, to: body.remediation },
      });
      return saved;
    });
    return { data };
  };
  return { getRules, getRuns, getScorecards, postRuns, patchResultsId };
}
