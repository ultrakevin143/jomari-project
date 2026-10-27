import type { DQRule } from "@prisma/client";
import { ApiError } from "../../shared/errors.js";
import { allowedTransition } from "../canonical/canonical.policy.js";
import { type Snapshot } from "./quality.repository.js";

export type Sample = {
  id: string;
  reason: string;
};
export type Outcome = {
  checked: number;
  failed: number;
  samples: Sample[];
};
export function check<
  T extends {
    id: string;
  },
>(rows: T[], predicate: (row: T) => boolean, reason: string): Outcome {
  const failures = rows.filter((r) => !predicate(r));
  return {
    checked: rows.length,
    failed: failures.length,
    samples: failures.slice(0, 5).map((r) => ({ id: r.id, reason })),
  };
}
export function combine(...checks: Outcome[]): Outcome {
  return {
    checked: checks.reduce((n, c) => n + c.checked, 0),
    failed: checks.reduce((n, c) => n + c.failed, 0),
    samples: checks.flatMap((c) => c.samples).slice(0, 5),
  };
}
export function qualityScore(checked: number, failed: number) {
  return checked === 0
    ? 100
    : Math.round(((checked - failed) / checked) * 10000) / 100;
}
export function evaluateRule(
  checkId: string,
  s: Snapshot,
  config: Record<string, unknown> = {},
  now = new Date(),
): Outcome {
  const present = (value: string) => value.trim().length > 0;
  const nonNegative = (values: number[]) =>
    values.every((value) => Number.isFinite(value) && value >= 0);
  const validTime = (value: Date, allowFuture = false) =>
    Number.isFinite(value.getTime()) &&
    value.getUTCFullYear() >= 2000 &&
    (allowFuture || value.getTime() <= now.getTime() + 86400000);
  switch (checkId) {
    case "completeness":
      return combine(
        check(
          s.routes,
          (r) => present(r.code) && present(r.name) && present(r.serviceAreaId),
          "Route identity or service area is missing.",
        ),
        check(
          s.vehicles,
          (v) => present(v.code) && present(v.registration) && present(v.type),
          "Vehicle identity is missing.",
        ),
        check(
          s.facilities,
          (f) => present(f.name) && present(f.code) && present(f.location),
          "Facility fields are missing.",
        ),
        check(
          s.weights,
          (w) =>
            present(w.ticketNumber) &&
            present(w.facilityId) &&
            present(w.materialTypeId),
          "Ticket identity or facility is missing.",
        ),
      );
    case "timestamps":
      return check(
        [
          ...s.routes.map((r) => ({
            id: r.id,
            valid:
              validTime(r.sourceUpdatedAt) && validTime(r.scheduledAt, true),
          })),
          ...s.vehicles.map((r) => ({
            id: r.id,
            valid: validTime(r.sourceUpdatedAt),
          })),
          ...s.facilities.map((r) => ({
            id: r.id,
            valid: validTime(r.sourceUpdatedAt),
          })),
          ...[...s.weights, ...s.recycling, ...s.events, ...s.telemetry].map(
            (r) => ({
              id: r.id,
              valid: validTime(r.sourceUpdatedAt) && validTime(r.occurredAt),
            }),
          ),
          ...s.requests.map((r) => ({
            id: r.id,
            valid:
              validTime(r.sourceUpdatedAt) &&
              validTime(r.reportedAt) &&
              (!r.resolvedAt ||
                (validTime(r.resolvedAt) && r.resolvedAt >= r.reportedAt)),
          })),
          ...s.workOrders.map((r) => ({
            id: r.id,
            valid: validTime(r.sourceUpdatedAt) && validTime(r.dueAt, true),
          })),
          ...s.contracts.map((r) => ({
            id: r.id,
            valid:
              validTime(r.sourceUpdatedAt) && validTime(r.validUntil, true),
          })),
        ],
        (r) => r.valid,
        "Invalid, implausible, or future timestamp.",
      );
    case "nonNegative":
      return combine(
        check(
          s.weights,
          (r) => nonNegative([r.grossKg, r.tareKg, r.netKg]),
          "Negative weighbridge quantity.",
        ),
        check(
          s.recycling,
          (r) =>
            nonNegative([r.receivedKg, r.recoveredKg, r.contaminationPct]) &&
            r.contaminationPct <= 100,
          "Negative recovery quantity.",
        ),
        check(
          s.vehicles,
          (v) => nonNegative([v.mileageKm, v.fuelLitres, v.capacityKg]),
          "Negative fleet quantity.",
        ),
        check(
          s.routes,
          (r) =>
            nonNegative([
              r.scheduledStops,
              r.completedStops,
              r.missedStops,
              r.durationMinutes,
            ]),
          "Negative stop count.",
        ),
        check(
          s.facilities,
          (f) => nonNegative([f.dailyCapacityKg]),
          "Negative facility capacity.",
        ),
        check(
          s.telemetry,
          (r) => nonNegative([r.mileageKm, r.fuelLitres]),
          "Negative telemetry quantity.",
        ),
        check(
          s.contracts,
          (r) =>
            nonNegative([r.ratePerTonne, r.slaTargetPct]) &&
            r.slaTargetPct <= 100,
          "Invalid contract rate or SLA percentage.",
        ),
      );
    case "materials": {
      const ids = new Set(s.materials.map((m) => m.id));
      return check(
        [...s.weights, ...s.recycling],
        (r) => ids.has(r.materialTypeId),
        "Unknown material reference.",
      );
    }
    case "duplicates": {
      const counts = new Map<string, number>();
      for (const r of s.raw)
        if (r.sourceRecordId) {
          const k = `${r.runId}:${r.sourceRecordId}`;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      return check(
        s.raw,
        (r) =>
          !r.sourceRecordId ||
          (counts.get(`${r.runId}:${r.sourceRecordId}`) ?? 0) <= 1,
        "Source ID appears more than once in the same import.",
      );
    }
    case "vehicles": {
      const regs = new Map<string, number>(),
        codes = new Map<string, number>();
      s.vehicles.forEach((v) => {
        const registration = v.registration.trim().toUpperCase(),
          code = v.code.trim().toUpperCase();
        regs.set(registration, (regs.get(registration) ?? 0) + 1);
        codes.set(code, (codes.get(code) ?? 0) + 1);
      });
      return check(
        s.vehicles,
        (v) =>
          regs.get(v.registration.trim().toUpperCase()) === 1 &&
          codes.get(v.code.trim().toUpperCase()) === 1,
        "Conflicting vehicle registration or fleet code.",
      );
    }
    case "references": {
      const routes = new Set(s.routes.map((r) => r.id)),
        vehicles = new Set(s.vehicles.map((v) => v.id));
      return check(
        s.events,
        (e) => routes.has(e.routeId) && vehicles.has(e.vehicleId),
        "Unknown or archived route / vehicle reference.",
      );
    }
    case "collection":
      return check(
        s.routes,
        (r) =>
          r.completedStops + r.missedStops <= r.scheduledStops &&
          (r.status !== "COMPLETED" ||
            r.completedStops + r.missedStops === r.scheduledStops),
        "Route status and stop counts disagree.",
      );
    case "netWeight":
      return check(
        s.weights,
        (w) => Math.abs(w.grossKg - w.tareKg - w.netKg) <= 1,
        "Net weight does not reconcile within 1 kg.",
      );
    case "recovery":
      return check(
        s.recycling,
        (r) => r.recoveredKg <= r.receivedKg || !!r.exceptionReason?.trim(),
        "Recovery exceeds received weight without an exception.",
      );
    case "transitions":
      return check(
        s.requests,
        (r) =>
          (!r.previousStatus ||
            allowedTransition(r.previousStatus, r.status)) &&
          (!["RESOLVED", "CLOSED"].includes(r.status) || !!r.resolvedAt),
        "Invalid status transition or missing resolution timestamp.",
      );
    case "freshness":
      return check(
        s.sources,
        (r) =>
          !!r.lastSuccessAt &&
          r.lastSuccessAt <= now &&
          r.freshnessHours > 0 &&
          (now.getTime() - r.lastSuccessAt.getTime()) / 3600000 <=
            r.freshnessHours,
        "Last successful import is missing or outside its freshness window.",
      );
    case "outliers":
      return combine(
        check(
          s.weights,
          (w) =>
            w.netKg <= Number(config.maxNetKg ?? 30000) &&
            w.netKg >= Number(config.minNetKg ?? 50),
          "Weight is outside configured bounds.",
        ),
        check(
          s.routes,
          (r) =>
            r.durationMinutes >= Number(config.minDurationMinutes ?? 30) &&
            r.durationMinutes <= Number(config.maxDurationMinutes ?? 600),
          "Route duration is outside configured bounds.",
        ),
      );
    case "classification":
      return check(
        s.assets,
        (a) =>
          !!a.owner.trim() &&
          !!a.steward.trim() &&
          !!a.policy.trim() &&
          a.retentionDays > 0 &&
          (!a.containsPii ||
            ["CONFIDENTIAL", "RESTRICTED"].includes(a.classification)),
        "Ownership, retention, policy or PII classification needs correction.",
      );
    default:
      throw new ApiError(
        422,
        "UNKNOWN_RULE",
        `Unsupported executable check: ${checkId}`,
      );
  }
}
export function domainScores(
  results: {
    checked: number;
    failed: number;
    rule: Pick<DQRule, "domain">;
  }[],
) {
  const grouped = new Map<
    string,
    {
      checked: number;
      failed: number;
    }
  >();
  for (const r of results) {
    const item = grouped.get(r.rule.domain) ?? { checked: 0, failed: 0 };
    item.checked += r.checked;
    item.failed += r.failed;
    grouped.set(r.rule.domain, item);
  }
  return [...grouped].map(([domain, c]) => ({
    domain,
    ...c,
    score: qualityScore(c.checked, c.failed),
  }));
}
