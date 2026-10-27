import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { pageResponse, paginate, paging } from "../../shared/validation.js";
import { type Entity } from "../canonical/canonical.schemas.js";

export async function listOperations(
  db: PrismaClient,
  entity: Entity,
  organizationId: string,
  q: z.infer<typeof paging>,
) {
  const base = {
    organizationId,
    ...(q.search
      ? { sourceRecordId: { contains: q.search, mode: "insensitive" as const } }
      : {}),
  };
  const options = {
    ...paginate(q.page, q.pageSize),
    orderBy: [{ sourceUpdatedAt: q.sort }, { id: q.sort }],
  };
  switch (entity) {
    case "routes": {
      const where: Prisma.CollectionRouteWhereInput = {
        ...base,
        archivedAt: null,
        ...(q.status
          ? {
              status: z
                .enum(["COMPLETED", "MISSED", "IN_PROGRESS", "SCHEDULED"])
                .parse(q.status),
            }
          : {}),
      };
      const [data, total] = await Promise.all([
        db.collectionRoute.findMany({
          where,
          ...options,
          include: {
            serviceArea: { select: { name: true } },
            vehicle: { select: { code: true } },
          },
        }),
        db.collectionRoute.count({ where }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "vehicles": {
      const where: Prisma.VehicleWhereInput = {
        ...base,
        archivedAt: null,
        ...(q.status
          ? {
              status: z
                .enum(["AVAILABLE", "ON_ROUTE", "MAINTENANCE"])
                .parse(q.status),
            }
          : {}),
      };
      const [data, total] = await Promise.all([
        db.vehicle.findMany({ where, ...options }),
        db.vehicle.count({ where }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "facilities": {
      const where = { ...base, archivedAt: null };
      const [data, total] = await Promise.all([
        db.facility.findMany({ where, ...options }),
        db.facility.count({ where }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "weighbridge": {
      const [data, total] = await Promise.all([
        db.weighbridgeTransaction.findMany({
          where: base,
          ...options,
          include: {
            facility: { select: { name: true } },
            materialType: { select: { name: true } },
          },
        }),
        db.weighbridgeTransaction.count({ where: base }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "recycling": {
      const [data, total] = await Promise.all([
        db.recyclingRecoveryRecord.findMany({
          where: base,
          ...options,
          include: {
            facility: { select: { name: true } },
            materialType: { select: { name: true } },
          },
        }),
        db.recyclingRecoveryRecord.count({ where: base }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "work-orders": {
      const where = {
        ...base,
        ...(q.status
          ? {
              status: z
                .enum(["OPEN", "IN_PROGRESS", "COMPLETED"])
                .parse(q.status),
            }
          : {}),
      };
      const [data, total] = await Promise.all([
        db.workOrder.findMany({
          where,
          ...options,
          include: { vehicle: { select: { code: true } } },
        }),
        db.workOrder.count({ where }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "citizen-requests": {
      const where = {
        ...base,
        ...(q.status
          ? {
              status: z
                .enum(["OPEN", "ASSIGNED", "RESOLVED", "CLOSED"])
                .parse(q.status),
            }
          : {}),
      };
      const [data, total] = await Promise.all([
        db.citizenRequest.findMany({
          where,
          ...options,
          select: {
            id: true,
            sourceRecordId: true,
            reference: true,
            category: true,
            location: true,
            status: true,
            reportedAt: true,
            resolvedAt: true,
            sourceUpdatedAt: true,
          },
        }),
        db.citizenRequest.count({ where }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "contracts": {
      const [data, total] = await Promise.all([
        db.serviceContract.findMany({
          where: base,
          ...options,
          include: { serviceArea: { select: { name: true } } },
        }),
        db.serviceContract.count({ where: base }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "collection-events": {
      const [data, total] = await Promise.all([
        db.collectionEvent.findMany({
          where: base,
          ...options,
          include: {
            route: { select: { code: true } },
            vehicle: { select: { code: true } },
          },
        }),
        db.collectionEvent.count({ where: base }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
    case "telemetry": {
      const [data, total] = await Promise.all([
        db.vehicleTelemetryEvent.findMany({
          where: base,
          ...options,
          include: { vehicle: { select: { code: true } } },
        }),
        db.vehicleTelemetryEvent.count({ where: base }),
      ]);
      return pageResponse(data, total, q.page, q.pageSize);
    }
  }
}
