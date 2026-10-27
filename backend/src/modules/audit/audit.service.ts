import { Prisma, type PrismaClient } from "@prisma/client";
import {
  requireIdentity,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
import { pageResponse, paginate, paging } from "../../shared/validation.js";
import { auditActionFilterSchema } from "./audit.schemas.js";
export function createAuditService(db: PrismaClient) {
  const getIndex = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const q = paging.parse(requestInput.query),
      entity = auditActionFilterSchema.parse(requestInput.query.entity);
    const where: Prisma.AuditEventWhereInput = {
      organizationId: requireIdentity(requestContext.user).organizationId,
      ...(q.search
        ? {
            OR: [
              { action: { contains: q.search, mode: "insensitive" } },
              { actorName: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(entity ? { entity } : {}),
    };
    const [data, total] = await Promise.all([
      db.auditEvent.findMany({
        where,
        orderBy: { createdAt: q.sort },
        ...paginate(q.page, q.pageSize),
      }),
      db.auditEvent.count({ where }),
    ]);
    return pageResponse(data, total, q.page, q.pageSize);
  };
  return { getIndex };
}
