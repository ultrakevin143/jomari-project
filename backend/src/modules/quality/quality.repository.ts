import type { Prisma, PrismaClient } from "@prisma/client";

export async function snapshot(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
) {
  const [
    routes,
    vehicles,
    facilities,
    weights,
    recycling,
    events,
    requests,
    raw,
    sources,
    assets,
    materials,
    telemetry,
    workOrders,
    contracts,
  ] = await Promise.all([
    db.collectionRoute.findMany({
      where: { organizationId, archivedAt: null },
    }),
    db.vehicle.findMany({ where: { organizationId, archivedAt: null } }),
    db.facility.findMany({ where: { organizationId, archivedAt: null } }),
    db.weighbridgeTransaction.findMany({ where: { organizationId } }),
    db.recyclingRecoveryRecord.findMany({ where: { organizationId } }),
    db.collectionEvent.findMany({ where: { organizationId } }),
    db.citizenRequest.findMany({ where: { organizationId } }),
    db.rawImportRecord.findMany({
      where: { organizationId },
      select: { id: true, runId: true, sourceRecordId: true },
    }),
    db.sourceSystem.findMany({ where: { organizationId } }),
    db.dataAsset.findMany({ where: { organizationId } }),
    db.materialType.findMany({ where: { organizationId } }),
    db.vehicleTelemetryEvent.findMany({ where: { organizationId } }),
    db.workOrder.findMany({ where: { organizationId } }),
    db.serviceContract.findMany({ where: { organizationId } }),
  ]);
  return {
    routes,
    vehicles,
    facilities,
    weights,
    recycling,
    events,
    requests,
    raw,
    sources,
    assets,
    materials,
    telemetry,
    workOrders,
    contracts,
  };
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
