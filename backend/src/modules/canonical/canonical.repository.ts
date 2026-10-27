import { ApiError } from "../../shared/errors.js";
import { type Entity } from "./canonical.schemas.js";
import { type DB } from "./canonical.types.js";

export async function existingRecord(
  db: DB,
  entity: Entity,
  where: {
    organizationId: string;
    sourceSystemId: string;
    sourceRecordId: string;
  },
) {
  switch (entity) {
    case "routes":
      return db.collectionRoute.findFirst({ where });
    case "vehicles":
      return db.vehicle.findFirst({ where });
    case "facilities":
      return db.facility.findFirst({ where });
    case "weighbridge":
      return db.weighbridgeTransaction.findFirst({ where });
    case "recycling":
      return db.recyclingRecoveryRecord.findFirst({ where });
    case "work-orders":
      return db.workOrder.findFirst({ where });
    case "citizen-requests":
      return db.citizenRequest.findFirst({ where });
    case "contracts":
      return db.serviceContract.findFirst({ where });
    case "collection-events":
      return db.collectionEvent.findFirst({ where });
    case "telemetry":
      return db.vehicleTelemetryEvent.findFirst({ where });
  }
}
export async function references(db: DB, organizationId: string, data: object) {
  const d = data as Record<string, unknown>;
  const refs: [string, (id: string) => Promise<unknown>][] = [
    [
      "serviceAreaId",
      (id) => db.serviceArea.findFirst({ where: { id, organizationId } }),
    ],
    [
      "vehicleId",
      (id) =>
        db.vehicle.findFirst({
          where: { id, organizationId, archivedAt: null },
        }),
    ],
    [
      "facilityId",
      (id) =>
        db.facility.findFirst({
          where: { id, organizationId, archivedAt: null },
        }),
    ],
    [
      "materialTypeId",
      (id) => db.materialType.findFirst({ where: { id, organizationId } }),
    ],
    [
      "routeId",
      (id) =>
        db.collectionRoute.findFirst({
          where: { id, organizationId, archivedAt: null },
        }),
    ],
  ];
  for (const [field, find] of refs)
    if (typeof d[field] === "string" && !(await find(d[field] as string)))
      throw new ApiError(
        422,
        "INVALID_REFERENCE",
        `${field} does not reference an active record in your organization.`,
      );
}
