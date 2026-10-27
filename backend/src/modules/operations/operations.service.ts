import type { PrismaClient } from "@prisma/client";
import { audit } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
import { paging, uuid } from "../../shared/validation.js";
import { entitySchema } from "../canonical/canonical.schemas.js";
import { mockRecords } from "../integrations/mock.adapter.js";
import { listOperations } from "./operations.repository.js";
import {
  archivableEntitySchema,
  archiveReasonSchema,
} from "./operations.schemas.js";
export function createOperationsService(db: PrismaClient) {
  const getLookups = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const organizationId = requireIdentity(requestContext.user).organizationId;
    const [areas, vehicles, facilities, materials] = await Promise.all([
      db.serviceArea.findMany({ where: { organizationId } }),
      db.vehicle.findMany({
        where: { organizationId, archivedAt: null },
        select: { id: true, code: true },
      }),
      db.facility.findMany({
        where: { organizationId, archivedAt: null },
        select: { id: true, name: true },
      }),
      db.materialType.findMany({ where: { organizationId } }),
    ]);
    return { data: { areas, vehicles, facilities, materials } };
  };
  const getTemplatesEntity = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return {
      data: await mockRecords(
        db,
        requireIdentity(requestContext.user).organizationId,
        entitySchema.parse(requestInput.params.entity),
      ),
    };
  };
  const getEntity = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return await listOperations(
      db,
      entitySchema.parse(requestInput.params.entity),
      requireIdentity(requestContext.user).organizationId,
      paging.parse(requestInput.query),
    );
  };
  const getEntityId = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const entity = entitySchema.parse(requestInput.params.entity),
      id = uuid.parse(requestInput.params.id),
      organizationId = requireIdentity(requestContext.user).organizationId,
      where = { id, organizationId };
    const find = () => {
      switch (entity) {
        case "routes":
          return db.collectionRoute.findFirst({
            where,
            include: {
              serviceArea: true,
              vehicle: { select: { code: true, registration: true } },
              stops: { orderBy: { sequence: "asc" } },
              events: { orderBy: { occurredAt: "desc" }, take: 30 },
            },
          });
        case "vehicles":
          return db.vehicle.findFirst({
            where,
            include: {
              workOrders: { take: 20, orderBy: { dueAt: "desc" } },
              telemetry: { take: 10, orderBy: { occurredAt: "desc" } },
            },
          });
        case "facilities":
          return db.facility.findFirst({ where });
        case "weighbridge":
          return db.weighbridgeTransaction.findFirst({
            where,
            include: { facility: true, materialType: true },
          });
        case "recycling":
          return db.recyclingRecoveryRecord.findFirst({
            where,
            include: { facility: true, materialType: true, incidents: true },
          });
        case "work-orders":
          return db.workOrder.findFirst({ where });
        case "citizen-requests":
          return db.citizenRequest.findFirst({
            where,
            select: {
              id: true,
              organizationId: true,
              sourceSystemId: true,
              sourceRecordId: true,
              sourceUpdatedAt: true,
              sourceVersion: true,
              reference: true,
              category: true,
              location: true,
              status: true,
              previousStatus: true,
              reportedAt: true,
              resolvedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        case "contracts":
          return db.serviceContract.findFirst({
            where,
            include: { serviceArea: true },
          });
        case "collection-events":
          return db.collectionEvent.findFirst({ where });
        case "telemetry":
          return db.vehicleTelemetryEvent.findFirst({ where });
      }
    };
    const data = await find();
    if (!data)
      throw new ApiError(404, "NOT_FOUND", "Operational record not found.");
    return { data };
  };
  const postEntityIdArchive = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const entity = archivableEntitySchema.parse(requestInput.params.entity),
      id = uuid.parse(requestInput.params.id),
      body = archiveReasonSchema.parse(requestInput.body),
      organizationId = requireIdentity(requestContext.user).organizationId;
    const data = await db.$transaction(async (tx) => {
      let count = 0;
      if (entity === "routes")
        count = (
          await tx.collectionRoute.updateMany({
            where: { id, organizationId, archivedAt: null },
            data: { archivedAt: new Date() },
          })
        ).count;
      if (entity === "vehicles") {
        if (
          await tx.collectionRoute.count({
            where: {
              organizationId,
              vehicleId: id,
              archivedAt: null,
              status: { in: ["SCHEDULED", "IN_PROGRESS"] },
            },
          })
        )
          throw new ApiError(
            409,
            "ACTIVE_ASSIGNMENT",
            "Reassign active routes before archiving this vehicle.",
          );
        count = (
          await tx.vehicle.updateMany({
            where: { id, organizationId, archivedAt: null },
            data: { archivedAt: new Date() },
          })
        ).count;
      }
      if (entity === "facilities")
        count = (
          await tx.facility.updateMany({
            where: { id, organizationId, archivedAt: null },
            data: { archivedAt: new Date() },
          })
        ).count;
      if (!count)
        throw new ApiError(404, "NOT_FOUND", "Active record not found.");
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "RECORD_ARCHIVED",
        entity,
        entityId: id,
        reason: body.reason,
      });
      return { id, archived: true };
    });
    return { data };
  };
  return {
    getLookups,
    getTemplatesEntity,
    getEntity,
    getEntityId,
    postEntityIdArchive,
  };
}
