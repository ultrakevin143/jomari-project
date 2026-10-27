import { ApiError } from "../../shared/errors.js";
import { allowedTransition } from "./canonical.policy.js";
import { existingRecord, references } from "./canonical.repository.js";
import { type Entity, schemas } from "./canonical.schemas.js";
import { type DB, type Meta } from "./canonical.types.js";

export async function saveCanonical(
  db: DB,
  entity: Entity,
  payload: unknown,
  meta: Meta,
) {
  const data = schemas[entity].parse(payload);
  await references(db, meta.organizationId, data);
  const where = {
    organizationId: meta.organizationId,
    sourceSystemId: meta.sourceSystemId,
    sourceRecordId: data.sourceRecordId,
  };
  const existing = await existingRecord(db, entity, where);
  if (existing?.sourceVersion === meta.sourceVersion)
    return { id: existing.id, skipped: true };
  if (existing && existing.sourceUpdatedAt > data.sourceUpdatedAt)
    throw new ApiError(
      422,
      "STALE_VERSION",
      "A newer version of this source record is already loaded.",
    );
  const unique = { organizationId_sourceSystemId_sourceRecordId: where };
  let saved: {
    id: string;
  };
  switch (entity) {
    case "routes": {
      const d = schemas.routes.parse(payload);
      saved = await db.collectionRoute.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
    case "vehicles": {
      const d = schemas.vehicles.parse(payload);
      saved = await db.vehicle.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
    case "facilities": {
      const d = schemas.facilities.parse(payload);
      saved = await db.facility.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
    case "weighbridge": {
      const d = schemas.weighbridge.parse(payload);
      saved = await db.weighbridgeTransaction.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
    case "recycling": {
      const d = schemas.recycling.parse(payload);
      saved = await db.recyclingRecoveryRecord.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
    case "work-orders": {
      const d = schemas["work-orders"].parse(payload);
      saved = await db.workOrder.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
    case "citizen-requests": {
      const d = schemas["citizen-requests"].parse(payload);
      const previous = await db.citizenRequest.findFirst({ where });
      if (previous && !allowedTransition(previous.status, d.status))
        throw new ApiError(
          422,
          "INVALID_TRANSITION",
          `Cannot move a citizen request from ${previous.status} to ${d.status}.`,
        );
      const next = { ...d, ...meta, previousStatus: previous?.status ?? null };
      saved = await db.citizenRequest.upsert({
        where: unique,
        create: next,
        update: next,
      });
      break;
    }
    case "contracts": {
      const d = schemas.contracts.parse(payload);
      saved = await db.serviceContract.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
    case "collection-events": {
      const d = schemas["collection-events"].parse(payload);
      saved = await db.collectionEvent.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
    case "telemetry": {
      const d = schemas.telemetry.parse(payload);
      saved = await db.vehicleTelemetryEvent.upsert({
        where: unique,
        create: { ...d, ...meta },
        update: { ...d, ...meta },
      });
      break;
    }
  }
  return { id: saved.id, skipped: false };
}
