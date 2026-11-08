import { Prisma, type PrismaClient } from "@prisma/client";
import { audit } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
import {
  pageResponse,
  paginate,
  paging,
  uuid,
} from "../../shared/validation.js";
import {
  assetClassificationFilterSchema,
  updateAssetPolicySchema,
} from "./governance.schemas.js";
export function createGovernanceService(db: PrismaClient) {
  const getDomains = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return {
      data: await db.dataDomain.findMany({
        where: {
          organizationId: requireIdentity(requestContext.user).organizationId,
        },
        orderBy: { name: "asc" },
        include: { _count: { select: { assets: true } } },
      }),
    };
  };
  const getAssets = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const q = paging.parse(requestInput.query),
      domainId = uuid.optional().parse(requestInput.query.domainId),
      classification = assetClassificationFilterSchema.parse(
        requestInput.query.classification,
      );
    const where: Prisma.DataAssetWhereInput = {
      organizationId: requireIdentity(requestContext.user).organizationId,
      ...(q.search
        ? { name: { contains: q.search, mode: "insensitive" } }
        : {}),
      ...(domainId ? { domainId } : {}),
      ...(classification ? { classification } : {}),
    };
    const [data, total, rules] = await Promise.all([
      db.dataAsset.findMany({
        where,
        ...paginate(q.page, q.pageSize),
        orderBy: { name: q.sort },
        include: {
          domain: { select: { name: true, code: true } },
          sourceSystem: { select: { name: true, method: true } },
        },
      }),
      db.dataAsset.count({ where }),
      db.dQRule.findMany({
        where: {
          organizationId: requireIdentity(requestContext.user).organizationId,
          active: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          domain: true,
          entity: true,
        },
      }),
    ]);
    return {
      ...pageResponse(
        data.map((asset) => ({
          ...asset,
          rules: rules.filter(
            (r) =>
              r.entity === asset.entity ||
              r.entity === "multi" ||
              r.entity === "assets",
          ),
        })),
        total,
        q.page,
        q.pageSize,
      ),
    };
  };
  const patchAssetsId = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const id = uuid.parse(requestInput.params.id),
      body = updateAssetPolicySchema.parse(requestInput.body);
    const asset = await db.dataAsset.findFirst({
      where: {
        id,
        organizationId: requireIdentity(requestContext.user).organizationId,
      },
    });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "Data asset not found.");
    if (
      asset.containsPii &&
      !["CONFIDENTIAL", "RESTRICTED"].includes(body.classification)
    )
      throw new ApiError(
        422,
        "PII_CLASSIFICATION",
        "PII assets must be confidential or restricted.",
      );
    const { reason, version, ...change } = body;
    const data = await db.$transaction(async (tx) => {
      const result = await tx.dataAsset.updateMany({
        where: { id, organizationId: asset.organizationId, version },
        data: { ...change, version: { increment: 1 } },
      });
      if (!result.count)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "This asset changed. Refresh and review it before saving.",
        );
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "GOVERNANCE_ASSET_CHANGED",
        entity: "data-asset",
        entityId: id,
        reason,
        metadata: {
          before: {
            owner: asset.owner,
            steward: asset.steward,
            classification: asset.classification,
            retentionDays: asset.retentionDays,
            policy: asset.policy,
          },
          after: change,
        },
      });
      return tx.dataAsset.findUniqueOrThrow({ where: { id } });
    });
    return { data };
  };
  const getRetentionPreview = async (
    input: ServiceInput,
    context: ServiceContext,
  ) => {
    const user = requireIdentity(context.user);
    const asset = await db.dataAsset.findFirst({
      where: {
        id: uuid.parse(input.params.id),
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        name: true,
        entity: true,
        sourceSystemId: true,
        retentionDays: true,
      },
    });
    if (!asset) throw new ApiError(404, "NOT_FOUND", "Data asset not found.");
    const cutoff = new Date(Date.now() - asset.retentionDays * 86400000);
    const where: Prisma.RawImportRecordWhereInput = {
      organizationId: user.organizationId,
      createdAt: { lt: cutoff },
      run: {
        organizationId: user.organizationId,
        sourceSystemId: asset.sourceSystemId,
        entity: asset.entity,
      },
    };
    const [count, records] = await Promise.all([
      db.rawImportRecord.count({ where }),
      db.rawImportRecord.findMany({
        where,
        take: 50,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, runId: true, createdAt: true, status: true },
      }),
    ]);
    await audit(db, {
      ...serviceAudit(context.audit),
      action: "RETENTION_PREVIEW",
      entity: "data-asset",
      entityId: asset.id,
      metadata: { count, retentionDays: asset.retentionDays },
    });
    return {
      data: {
        asset: { id: asset.id, name: asset.name },
        retentionDays: asset.retentionDays,
        cutoff,
        count,
        records,
      },
    };
  };
  return { getDomains, getAssets, patchAssetsId, getRetentionPreview };
}
