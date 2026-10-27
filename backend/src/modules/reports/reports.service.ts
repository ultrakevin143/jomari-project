import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../shared/audit.js";
import { csv } from "../../shared/csv.js";
import { ApiError } from "../../shared/errors.js";
import { domainScores } from "../quality/quality.engine.js";
import { reportData } from "./reports.repository.js";
import { reportNameSchema } from "./reports.schemas.js";

import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
export const dateQuery = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});
export async function reportingPeriod(
  db: PrismaClient,
  organizationId: string,
  input: unknown,
) {
  const q = dateQuery.parse(input);
  const latest =
    !q.from || !q.to
      ? await db.collectionRoute.findFirst({
          where: { organizationId, archivedAt: null },
          orderBy: { scheduledAt: "desc" },
          select: { scheduledAt: true },
        })
      : null;
  const to =
    q.to ?? (latest?.scheduledAt ?? new Date()).toISOString().slice(0, 10);
  const from =
    q.from ??
    new Date(new Date(`${to}T00:00:00Z`).getTime() - 6 * 86400000)
      .toISOString()
      .slice(0, 10);
  const start = new Date(`${from}T00:00:00Z`),
    end = new Date(`${to}T00:00:00Z`);
  if (start > end || end.getTime() - start.getTime() > 365 * 86400000)
    throw new ApiError(
      422,
      "INVALID_PERIOD",
      "Choose a reporting range between 1 and 366 days.",
    );
  return {
    from,
    to,
    start,
    end: new Date(end.getTime() + 86400000),
    timezone: "UTC",
    format: q.format,
  };
}
export const overviewCache = new Map<
  string,
  {
    until: number;
    data: unknown;
  }
>();
export function invalidateReports() {
  overviewCache.clear();
}
export function createReportsService(db: PrismaClient, demoMode: boolean) {
  const getOverview = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const organizationId = requireIdentity(requestContext.user).organizationId;
    const parsed = dateQuery.parse(requestInput.query),
      key = `${organizationId}:${parsed.from ?? ""}:${parsed.to ?? ""}`;
    const cached = overviewCache.get(key);
    if (cached && cached.until > Date.now()) return { data: cached.data };
    const period = await reportingPeriod(
      db,
      organizationId,
      requestInput.query,
    );
    const [
      report,
      organization,
      sources,
      quality,
      vehicles,
      openWorkOrders,
      openRequests,
    ] = await Promise.all([
      reportData(db, organizationId, period),
      db.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { name: true, timezone: true },
      }),
      db.sourceSystem.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        include: { runs: { take: 1, orderBy: { startedAt: "desc" } } },
      }),
      db.dQRun.findFirst({
        where: {
          organizationId,
          finishedAt: { not: null },
          status: { not: "FAILED" },
        },
        orderBy: { startedAt: "desc" },
        include: { results: { include: { rule: true } } },
      }),
      db.vehicle.groupBy({
        by: ["status"],
        where: { organizationId, archivedAt: null },
        _count: true,
      }),
      db.workOrder.count({
        where: { organizationId, status: { not: "COMPLETED" } },
      }),
      db.citizenRequest.count({
        where: { organizationId, status: { in: ["OPEN", "ASSIGNED"] } },
      }),
    ]);
    const series = new Map<
      string,
      {
        date: string;
        scheduled: number;
        completed: number;
        missed: number;
      }
    >();
    for (
      let day = period.start;
      day < period.end;
      day = new Date(day.getTime() + 86400000)
    ) {
      const date = day.toISOString().slice(0, 10);
      series.set(date, { date, scheduled: 0, completed: 0, missed: 0 });
    }
    for (const route of report.routes) {
      const day = series.get(route.scheduledAt.toISOString().slice(0, 10))!;
      day.scheduled += route.scheduledStops;
      day.completed += route.completedStops;
      day.missed += route.missedStops;
    }
    const data = {
      organization,
      period: { from: period.from, to: period.to, timezone: "UTC" },
      demoMode,
      totals: report.totals,
      series: [...series.values()],
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        domain: s.domain,
        method: s.method,
        lastSuccessAt: s.lastSuccessAt,
        freshnessHours: s.freshnessHours,
        stale:
          !s.lastSuccessAt ||
          Date.now() - s.lastSuccessAt.getTime() > s.freshnessHours * 3600000,
        lastRun: s.runs[0] ?? null,
      })),
      quality: quality
        ? {
            id: quality.id,
            score: quality.score,
            checked: quality.checked,
            failed: quality.failed,
            finishedAt: quality.finishedAt,
            domains: domainScores(quality.results),
          }
        : null,
      fleet: vehicles.map((v) => ({ status: v.status, count: v._count })),
      openWorkOrders,
      openRequests,
      exceptions: report.routes
        .filter((r) => r.missedStops > 0 || r.status === "IN_PROGRESS")
        .sort((a, b) => b.missedStops - a.missedStops)
        .slice(0, 8),
      generatedAt: new Date(),
    };
    if (overviewCache.size > 200) overviewCache.clear();
    overviewCache.set(key, { until: Date.now() + 60000, data });
    return { data };
  };
  const getReportsReport = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const type = reportNameSchema.parse(requestInput.params.report),
      period = await reportingPeriod(
        db,
        requireIdentity(requestContext.user).organizationId,
        requestInput.query,
      ),
      report = await reportData(
        db,
        requireIdentity(requestContext.user).organizationId,
        period,
      );
    const rows: Record<string, unknown>[] =
      type === "operations"
        ? report.routes.map((r) => ({
            route: r.code,
            name: r.name,
            serviceArea: r.serviceArea.name,
            vehicle: r.vehicle?.code ?? "Unassigned",
            scheduledAt: r.scheduledAt,
            scheduledStops: r.scheduledStops,
            completedStops: r.completedStops,
            missedStops: r.missedStops,
            completionPct: r.scheduledStops
              ? Math.round((r.completedStops / r.scheduledStops) * 10000) / 100
              : 0,
            status: r.status,
          }))
        : report.recycling.map((r) => ({
            sourceRecordId: r.sourceRecordId,
            facility: r.facility.name,
            material: r.materialType.name,
            occurredAt: r.occurredAt,
            receivedKg: r.receivedKg,
            recoveredKg: r.recoveredKg,
            contaminationPct: r.contaminationPct,
            exceptionReason: r.exceptionReason ?? "",
          }));
    if (period.format === "csv") {
      await audit(db, {
        ...serviceAudit(requestContext.audit),
        action: "REPORT_EXPORTED",
        entity: type,
        metadata: { from: period.from, to: period.to, rows: rows.length },
      });
      const responseDisposition = `attachment; filename="${type}-${period.from}-${period.to}.csv"`;
      return {
        kind: "download" as const,
        content: csv(rows),
        disposition: responseDisposition,
      };
    } else
      return {
        kind: "json" as const,
        payload: {
          data: {
            period: { from: period.from, to: period.to, timezone: "UTC" },
            totals: report.totals,
            rows,
          },
        },
      };
  };
  return { getOverview, getReportsReport };
}
