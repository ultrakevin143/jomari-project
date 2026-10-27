import type { PrismaClient } from "@prisma/client";
import { ApiError } from "../../shared/errors.js";
import { pageResponse, paging, uuid } from "../../shared/validation.js";
import { reportingPeriod } from "../reports/reports.service.js";
import { qualityTrendLimitSchema } from "./insights.schemas.js";

import {
  requireIdentity,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
export const qualityPercentage = (checked: number, failed: number) =>
  checked ? Math.round(10000 * (1 - failed / checked)) / 100 : null;
export function groupQuality(
  results: {
    checked: number;
    failed: number;
    rule: {
      domain: string;
    };
  }[],
) {
  const groups = new Map<
    string,
    {
      domain: string;
      checked: number;
      failed: number;
    }
  >();
  for (const result of results) {
    const group = groups.get(result.rule.domain) ?? {
      domain: result.rule.domain,
      checked: 0,
      failed: 0,
    };
    group.checked += result.checked;
    group.failed += result.failed;
    groups.set(group.domain, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.domain.localeCompare(b.domain))
    .map((g) => ({ ...g, score: qualityPercentage(g.checked, g.failed) }));
}
export function createInsightsService(db: PrismaClient) {
  const getQualityTrends = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const limit = qualityTrendLimitSchema.parse(requestInput.query.limit);
    const runs = await db.dQRun.findMany({
      where: {
        organizationId: requireIdentity(requestContext.user).organizationId,
        status: { in: ["SUCCEEDED", "PARTIAL"] },
        finishedAt: { not: null },
      },
      take: limit,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      include: {
        results: {
          select: {
            checked: true,
            failed: true,
            rule: { select: { domain: true } },
          },
        },
      },
    });
    const previous = groupQuality(runs[1]?.results ?? []);
    return {
      data: {
        runs: runs
          .map((r) => ({
            id: r.id,
            startedAt: r.startedAt,
            checked: r.checked,
            failed: r.failed,
            score: qualityPercentage(r.checked, r.failed),
          }))
          .reverse(),
        domains: groupQuality(runs[0]?.results ?? []).map((d) => {
          const before = previous.find((p) => p.domain === d.domain)?.score;
          return {
            ...d,
            previousScore: before ?? null,
            change:
              d.score !== null && before !== null && before !== undefined
                ? Math.round((d.score - before) * 100) / 100
                : null,
          };
        }),
        formula:
          "100 × (1 − failed record-rule observations / checked observations). Domain scores are weighted by observations. Change is percentage points against the previous completed run; rule or coverage changes can affect comparisons.",
      },
    };
  };
  const getCollectionReliability = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const organizationId = requireIdentity(requestContext.user).organizationId,
      period = await reportingPeriod(db, organizationId, requestInput.query),
      areaId = uuid.optional().parse(requestInput.query.areaId),
      q = paging.parse(requestInput.query);
    const areas = await db.serviceArea.findMany({
      where: { organizationId },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
    if (areaId && !areas.some((a) => a.id === areaId))
      throw new ApiError(
        404,
        "NOT_FOUND",
        "Service area not found in this workspace.",
      );
    const routes = await db.collectionRoute.findMany({
      where: {
        organizationId,
        archivedAt: null,
        scheduledAt: { gte: period.start, lt: period.end },
        ...(areaId ? { serviceAreaId: areaId } : {}),
      },
      include: {
        serviceArea: { select: { id: true, name: true } },
        vehicle: { select: { id: true, code: true, status: true } },
        _count: { select: { events: true } },
      },
      orderBy: [{ scheduledAt: "desc" }, { code: "asc" }],
    });
    const now = Date.now(),
      rows = routes.map((r) => {
        const due = r.scheduledAt.getTime() + r.durationMinutes * 60000 < now,
          overdue = due && r.status !== "COMPLETED",
          findings: string[] = [];
        if (r.missedStops > 0) findings.push(`${r.missedStops} missed stops`);
        if (overdue)
          findings.push("Planned finish has passed; route is not completed");
        if (!r.vehicle) findings.push("No vehicle assigned");
        else if (r.vehicle.status === "MAINTENANCE" && r.status !== "COMPLETED")
          findings.push("Assigned vehicle is in maintenance");
        if (
          r.completedStops + r.missedStops > r.scheduledStops ||
          (r.status === "COMPLETED" &&
            r.completedStops + r.missedStops !== r.scheduledStops)
        )
          findings.push("Route status and stop counts require reconciliation");
        if (due && r._count.events === 0)
          findings.push("No collection-event evidence recorded");
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          scheduledAt: r.scheduledAt,
          status: r.status,
          area: r.serviceArea,
          vehicle: r.vehicle?.code ?? null,
          scheduledStops: r.scheduledStops,
          completedStops: r.completedStops,
          missedStops: r.missedStops,
          eventCount: r._count.events,
          overdue,
          findings,
        };
      });
    const scheduled = rows.reduce((n, r) => n + r.scheduledStops, 0),
      completed = rows.reduce((n, r) => n + r.completedStops, 0),
      filtered = q.search
        ? rows.filter((r) =>
            `${r.code} ${r.name}`
              .toLowerCase()
              .includes(q.search.toLowerCase()),
          )
        : rows;
    return {
      ...pageResponse(
        filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
        filtered.length,
        q.page,
        q.pageSize,
      ),
      areas,
      period: { from: period.from, to: period.to, timezone: period.timezone },
      summary: {
        routes: rows.length,
        scheduledStops: scheduled,
        completedStops: completed,
        missedStops: rows.reduce((n, r) => n + r.missedStops, 0),
        completionPct: scheduled
          ? Math.round((completed / scheduled) * 10000) / 100
          : null,
        overdueRoutes: rows.filter((r) => r.overdue).length,
        unassignedRoutes: rows.filter((r) => !r.vehicle).length,
        routesWithFindings: rows.filter((r) => r.findings.length).length,
      },
      coverage:
        "Unarchived routes scheduled in the selected inclusive UTC dates. Overdue means planned start plus recorded duration has passed and status is not Completed. Findings can overlap. Missing event evidence does not prove a missed collection; investigate the source record. Search filters the table only; totals retain period and service-area scope.",
    };
  };
  return { getQualityTrends, getCollectionReliability };
}
