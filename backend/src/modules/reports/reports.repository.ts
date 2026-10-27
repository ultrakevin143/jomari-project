import type { PrismaClient } from "@prisma/client";
import { reportingPeriod } from "./reports.service.js";

export async function reportData(
  db: PrismaClient,
  organizationId: string,
  period: Awaited<ReturnType<typeof reportingPeriod>>,
) {
  const [routes, weights, recycling] = await Promise.all([
    db.collectionRoute.findMany({
      where: {
        organizationId,
        archivedAt: null,
        scheduledAt: { gte: period.start, lt: period.end },
      },
      include: {
        serviceArea: { select: { name: true } },
        vehicle: { select: { code: true } },
      },
      orderBy: { scheduledAt: "desc" },
    }),
    db.weighbridgeTransaction.findMany({
      where: {
        organizationId,
        occurredAt: { gte: period.start, lt: period.end },
      },
      include: { materialType: { select: { name: true } } },
    }),
    db.recyclingRecoveryRecord.findMany({
      where: {
        organizationId,
        occurredAt: { gte: period.start, lt: period.end },
      },
      include: {
        materialType: { select: { name: true } },
        facility: { select: { name: true } },
      },
    }),
  ]);
  const scheduled = routes.reduce((n, r) => n + r.scheduledStops, 0),
    completed = routes.reduce((n, r) => n + r.completedStops, 0),
    missed = routes.reduce((n, r) => n + r.missedStops, 0),
    netKg = weights.reduce((n, w) => n + w.netKg, 0),
    receivedKg = recycling.reduce((n, r) => n + r.receivedKg, 0),
    recoveredKg = recycling.reduce((n, r) => n + r.recoveredKg, 0);
  return {
    routes,
    weights,
    recycling,
    totals: {
      scheduled,
      completed,
      missed,
      netKg,
      receivedKg,
      recoveredKg,
      completionPct: scheduled ? (completed / scheduled) * 100 : null,
      diversionPct: netKg ? (recoveredKg / netKg) * 100 : null,
      contaminationPct: receivedKg
        ? recycling.reduce((n, r) => n + r.contaminationPct * r.receivedKg, 0) /
          receivedKg
        : null,
    },
  };
}
