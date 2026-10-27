import type { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "../../shared/errors.js";
import { type Entity } from "../canonical/canonical.schemas.js";

export const DEMO_TIME = "2026-10-26T08:00:00.000Z";
export async function mockRecords(
  db: PrismaClient,
  organizationId: string,
  entity: Entity,
): Promise<Prisma.InputJsonObject[]> {
  const [area, vehicle, facility, material, route] = await Promise.all([
    db.serviceArea.findFirst({
      where: { organizationId },
      orderBy: { code: "asc" },
    }),
    db.vehicle.findFirst({
      where: { organizationId, archivedAt: null },
      orderBy: { code: "asc" },
    }),
    db.facility.findFirst({
      where: { organizationId, archivedAt: null },
      orderBy: { code: "asc" },
    }),
    db.materialType.findFirst({
      where: { organizationId },
      orderBy: { code: "asc" },
    }),
    db.collectionRoute.findFirst({
      where: { organizationId, archivedAt: null },
      orderBy: { code: "asc" },
    }),
  ]);
  const base = {
    sourceRecordId: `mock-${entity}-001`,
    sourceUpdatedAt: DEMO_TIME,
  };
  const need = (
    value: {
      id: string;
    } | null,
    name: string,
  ) => {
    if (!value)
      throw new ApiError(
        422,
        "MISSING_REFERENCE",
        `Add a ${name} before running this mock adapter.`,
      );
    return value.id;
  };
  switch (entity) {
    case "routes":
      return [
        {
          ...base,
          code: "R-M01",
          name: "Riverside relief route",
          serviceAreaId: need(area, "service area"),
          vehicleId: need(vehicle, "vehicle"),
          scheduledStops: 60,
          completedStops: 57,
          missedStops: 3,
          scheduledAt: DEMO_TIME,
          durationMinutes: 240,
          status: "COMPLETED",
        },
      ];
    case "vehicles":
      return [
        {
          ...base,
          registration: "DEMO-M01",
          code: "V-M01",
          type: "Rear loader",
          capacityKg: 9000,
          mileageKm: 14500,
          fuelLitres: 32,
          status: "AVAILABLE",
        },
      ];
    case "facilities":
      return [
        {
          ...base,
          code: "F-M01",
          name: "Riverside transfer station",
          type: "TRANSFER_STATION",
          location: "Demo industrial district",
          dailyCapacityKg: 120000,
        },
      ];
    case "weighbridge":
      return [
        {
          ...base,
          ticketNumber: "WB-M001",
          facilityId: need(facility, "facility"),
          materialTypeId: need(material, "material type"),
          grossKg: 14000,
          tareKg: 6500,
          netKg: 7500,
          occurredAt: DEMO_TIME,
        },
      ];
    case "recycling":
      return [
        {
          ...base,
          facilityId: need(facility, "facility"),
          materialTypeId: need(material, "material type"),
          receivedKg: 4200,
          recoveredKg: 3640,
          contaminationPct: 8.2,
          occurredAt: DEMO_TIME,
        },
      ];
    case "work-orders":
      return [
        {
          ...base,
          reference: "WO-M001",
          title: "Inspect hydraulic lift",
          vehicleId: need(vehicle, "vehicle"),
          assignee: "Fleet workshop team",
          priority: "WARNING",
          status: "OPEN",
          dueAt: "2026-10-28T08:00:00Z",
        },
      ];
    case "citizen-requests":
      return [
        {
          ...base,
          reference: "CR-M001",
          category: "Missed collection",
          location: "Riverside / block 4",
          citizenAlias: "Synthetic resident M001",
          status: "OPEN",
          reportedAt: DEMO_TIME,
        },
      ];
    case "contracts":
      return [
        {
          ...base,
          reference: "SC-M001",
          vendor: "Demo circular services",
          serviceAreaId: need(area, "service area"),
          slaTargetPct: 98,
          ratePerTonne: 1250,
          validUntil: "2027-10-26T00:00:00Z",
        },
      ];
    case "collection-events":
      return [
        {
          ...base,
          routeId: need(route, "route"),
          vehicleId: need(vehicle, "vehicle"),
          occurredAt: DEMO_TIME,
          status: "COMPLETED",
        },
      ];
    case "telemetry":
      return [
        {
          ...base,
          vehicleId: need(vehicle, "vehicle"),
          occurredAt: DEMO_TIME,
          latitude: 14.5995,
          longitude: 120.9842,
          mileageKm: 14500,
          fuelLitres: 32,
        },
      ];
  }
}
