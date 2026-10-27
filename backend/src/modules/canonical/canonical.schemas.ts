import { z } from "zod";

export const entityNames = [
  "routes",
  "vehicles",
  "facilities",
  "weighbridge",
  "recycling",
  "work-orders",
  "citizen-requests",
  "contracts",
  "collection-events",
  "telemetry",
] as const;
export type Entity = (typeof entityNames)[number];
export const entitySchema = z.enum(entityNames);
export const text = z.string().trim().min(1).max(200);
export const number = z.preprocess(
  (v) =>
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : undefined,
  z.coerce.number().finite().nonnegative().max(1000000000),
);
export const integer = number.pipe(z.number().int());
export const timestamp = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(v));
export const common = { sourceRecordId: text, sourceUpdatedAt: timestamp };
export const schemas = {
  routes: z
    .object({
      ...common,
      code: text,
      name: text,
      serviceAreaId: z.uuid(),
      vehicleId: z.uuid().optional(),
      scheduledStops: integer,
      completedStops: integer,
      missedStops: integer.default(0),
      scheduledAt: timestamp,
      durationMinutes: integer,
      status: z.enum(["COMPLETED", "MISSED", "IN_PROGRESS", "SCHEDULED"]),
    })
    .strict()
    .refine(
      (d) => d.completedStops + d.missedStops <= d.scheduledStops,
      "Completed plus missed stops cannot exceed scheduled stops.",
    )
    .refine(
      (d) =>
        d.status !== "COMPLETED" ||
        d.completedStops + d.missedStops === d.scheduledStops,
      "A completed route must account for every scheduled stop.",
    ),
  vehicles: z
    .object({
      ...common,
      registration: text.transform((v) => v.toUpperCase()),
      code: text,
      type: text,
      capacityKg: number,
      mileageKm: number,
      fuelLitres: number,
      status: z.enum(["AVAILABLE", "ON_ROUTE", "MAINTENANCE"]),
    })
    .strict(),
  facilities: z
    .object({
      ...common,
      code: text,
      name: text,
      type: z.enum(["TRANSFER_STATION", "RECYCLING_FACILITY", "LANDFILL"]),
      location: text,
      dailyCapacityKg: number,
    })
    .strict(),
  weighbridge: z
    .object({
      ...common,
      ticketNumber: text,
      facilityId: z.uuid(),
      materialTypeId: z.uuid(),
      grossKg: number,
      tareKg: number,
      netKg: number,
      occurredAt: timestamp,
    })
    .strict()
    .refine(
      (d) => Math.abs(d.grossKg - d.tareKg - d.netKg) <= 1,
      "Net weight must equal gross minus tare (1 kg tolerance).",
    ),
  recycling: z
    .object({
      ...common,
      facilityId: z.uuid(),
      materialTypeId: z.uuid(),
      receivedKg: number,
      recoveredKg: number,
      contaminationPct: number.pipe(z.number().max(100)),
      exceptionReason: text.optional(),
      occurredAt: timestamp,
    })
    .strict()
    .refine(
      (d) => d.recoveredKg <= d.receivedKg || !!d.exceptionReason,
      "Recovery cannot exceed received weight without an exception reason.",
    ),
  "work-orders": z
    .object({
      ...common,
      reference: text,
      title: text,
      vehicleId: z.uuid().optional(),
      assignee: text,
      priority: z.enum(["INFO", "WARNING", "ERROR"]),
      status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]),
      dueAt: timestamp,
    })
    .strict(),
  "citizen-requests": z
    .object({
      ...common,
      reference: text,
      category: text,
      location: text,
      citizenAlias: text,
      status: z.enum(["OPEN", "ASSIGNED", "RESOLVED", "CLOSED"]),
      reportedAt: timestamp,
      resolvedAt: timestamp.optional(),
    })
    .strict()
    .refine(
      (d) => !["RESOLVED", "CLOSED"].includes(d.status) || !!d.resolvedAt,
      "Resolved or closed requests require resolvedAt.",
    )
    .refine(
      (d) => !d.resolvedAt || d.resolvedAt >= d.reportedAt,
      "Resolution cannot precede the report.",
    ),
  contracts: z
    .object({
      ...common,
      reference: text,
      vendor: text,
      serviceAreaId: z.uuid(),
      slaTargetPct: number.pipe(z.number().max(100)),
      ratePerTonne: number,
      validUntil: timestamp,
    })
    .strict(),
  "collection-events": z
    .object({
      ...common,
      routeId: z.uuid(),
      vehicleId: z.uuid(),
      occurredAt: timestamp,
      status: z.enum(["COMPLETED", "MISSED", "IN_PROGRESS", "SCHEDULED"]),
    })
    .strict(),
  telemetry: z
    .object({
      ...common,
      vehicleId: z.uuid(),
      occurredAt: timestamp,
      latitude: z.preprocess(
        (v) =>
          typeof v === "number"
            ? v
            : typeof v === "string" && v.trim() !== ""
              ? Number(v)
              : undefined,
        z.number().finite().min(-90).max(90),
      ),
      longitude: z.preprocess(
        (v) =>
          typeof v === "number"
            ? v
            : typeof v === "string" && v.trim() !== ""
              ? Number(v)
              : undefined,
        z.number().finite().min(-180).max(180),
      ),
      mileageKm: number,
      fuelLitres: number,
    })
    .strict(),
};
export function validateRecord(entity: Entity, payload: unknown) {
  return schemas[entity].safeParse(payload);
}
