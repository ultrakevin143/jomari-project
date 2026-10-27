import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { type Entity } from "../src/modules/canonical/canonical.schemas.js";
import { executeImport } from "../src/modules/integrations/integrations.service.js";
import { DEMO_TIME } from "../src/modules/integrations/mock.adapter.js";
import { ruleDefinitions } from "../src/modules/quality/quality.rules.js";
import { executeQuality } from "../src/modules/quality/quality.service.js";
import { audit } from "../src/shared/audit.js";
import { hashPassword } from "../src/shared/security.js";

export function seedId(key: string) {
  const hex = createHash("sha256").update(`wastehub:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export const DEMO_ORG = seedId("organization");
type SeedRecord = Record<string, string | number | boolean | null>;
export async function seed(db: PrismaClient, password: string) {
  const organizationId = DEMO_ORG,
    ctx = {
      organizationId,
      actorName: "Synthetic seed",
      requestId: "deterministic-seed-v1",
    };
  await db.organization.upsert({
    where: { id: organizationId },
    create: { id: organizationId, name: "San Isidro · Demo municipality" },
    update: {},
  });
  const all = [
    "operations:read",
    "operations:write",
    "integrations:read",
    "integrations:write",
    "dq:read",
    "dq:write",
    "governance:read",
    "governance:write",
    "audit:read",
    "reports:read",
  ];
  const roleSpecs = [
    ["admin", "Administrator", all],
    [
      "operator",
      "Integration operator",
      all.filter((p) => !["governance:write", "operations:write"].includes(p)),
    ],
    [
      "steward",
      "Data steward",
      all.filter(
        (p) => !["integrations:write", "operations:write"].includes(p),
      ),
    ],
    [
      "analyst",
      "Read-only analyst",
      ["operations:read", "dq:read", "governance:read", "reports:read"],
    ],
  ] as const;
  const passwordHash = await hashPassword(password);
  for (const [code, name, permissions] of roleSpecs) {
    const roleId = seedId(`role:${code}`);
    await db.role.upsert({
      where: { id: roleId },
      create: { id: roleId, organizationId, code, name },
      update: {},
    });
    for (const permission of permissions)
      await db.permission.upsert({
        where: { roleId_code: { roleId, code: permission } },
        create: { roleId, code: permission },
        update: {},
      });
    const names: Record<string, string> = {
      admin: "Operations administrator",
      operator: "Integration desk",
      steward: "Municipal data steward",
      analyst: "Service analyst",
    };
    await db.user.upsert({
      where: { email: `${code}@wastehub.demo` },
      create: {
        id: seedId(`user:${code}`),
        organizationId,
        roleId,
        email: `${code}@wastehub.demo`,
        name: names[code]!,
        passwordHash,
      },
      update: {},
    });
  }
  const domains = [
    [
      "collection",
      "Collection",
      "Route scheduling, service completion and missed stops.",
      "Operations superintendent",
      "Collection planning team",
    ],
    [
      "fleet",
      "Fleet",
      "Vehicles, telemetry, maintenance and work orders.",
      "Fleet manager",
      "Workshop coordinator",
    ],
    [
      "materials",
      "Materials",
      "Facility receipts, recovery, contamination and diversion.",
      "Resource recovery manager",
      "Weighbridge supervisor",
    ],
    [
      "service",
      "Service",
      "Synthetic citizen requests and service contracts.",
      "Municipal services lead",
      "Service desk coordinator",
    ],
  ] as const;
  for (const [code, name, description, owner, steward] of domains)
    await db.dataDomain.upsert({
      where: { id: seedId(`domain:${code}`) },
      create: {
        id: seedId(`domain:${code}`),
        organizationId,
        code,
        name,
        description,
        owner,
        steward,
      },
      update: {},
    });
  const sourceSpecs = [
    [
      "collection",
      "Collection management",
      "routes",
      "collection",
      "CSV / REST",
      12,
    ],
    ["fleet", "Fleet & telemetry", "vehicles", "fleet", "REST", 6],
    [
      "weighbridge",
      "Weighbridge ledger",
      "weighbridge",
      "materials",
      "CSV",
      24,
    ],
    [
      "recycling",
      "Materials recovery facility",
      "recycling",
      "materials",
      "CSV",
      24,
    ],
    [
      "workorders",
      "Maintenance work orders",
      "work-orders",
      "fleet",
      "REST",
      24,
    ],
    [
      "contracts",
      "Vendor & service contracts",
      "contracts",
      "service",
      "CSV",
      168,
    ],
    [
      "citizen",
      "Citizen service desk",
      "citizen-requests",
      "service",
      "REST",
      12,
    ],
  ] as const;
  for (const [
    code,
    name,
    entity,
    domain,
    method,
    freshnessHours,
  ] of sourceSpecs) {
    const id = seedId(`source:${code}`);
    await db.sourceSystem.upsert({
      where: { id },
      create: {
        id,
        organizationId,
        code,
        name,
        entity,
        domain,
        method,
        freshnessHours,
      },
      update: {},
    });
    for (const adapter of ["csv", "mock"])
      await db.integrationConnection.upsert({
        where: { sourceSystemId_adapter: { sourceSystemId: id, adapter } },
        create: { organizationId, sourceSystemId: id, adapter },
        update: {},
      });
    const domainInfo = domains.find((d) => d[0] === domain)!;
    await db.dataAsset.upsert({
      where: {
        organizationId_sourceSystemId_entity: {
          organizationId,
          sourceSystemId: id,
          entity,
        },
      },
      create: {
        organizationId,
        sourceSystemId: id,
        domainId: seedId(`domain:${domain}`),
        name: name + " records",
        entity,
        owner: domainInfo[3],
        steward: domainInfo[4],
        classification: code === "citizen" ? "CONFIDENTIAL" : "INTERNAL",
        containsPii: code === "citizen",
        retentionDays: code === "citizen" ? 365 : 2555,
        policy:
          code === "citizen"
            ? "Synthetic aliases only. Anonymize contact data after service closure; retain classified records for 365 days."
            : "Retain operational records for seven years. Archive source payloads under the same access policy.",
      },
      update: {},
    });
  }
  for (const [index, name] of [
    "Poblacion",
    "Riverside",
    "North district",
  ].entries())
    await db.serviceArea.upsert({
      where: { id: seedId(`area:${index}`) },
      create: {
        id: seedId(`area:${index}`),
        organizationId,
        code: `SA-0${index + 1}`,
        name,
      },
      update: {},
    });
  for (const [code, name, recyclable] of [
    ["MIXED", "Mixed municipal waste", false],
    ["PAPER", "Paper & cardboard", true],
    ["PLASTIC", "Mixed plastics", true],
    ["METAL", "Ferrous & non-ferrous metals", true],
  ] as const)
    await db.materialType.upsert({
      where: { id: seedId(`material:${code}`) },
      create: {
        id: seedId(`material:${code}`),
        organizationId,
        code,
        name,
        recyclable,
      },
      update: {},
    });
  const load = async (source: string, entity: Entity, records: SeedRecord[]) =>
    executeImport(
      db,
      {
        sourceSystemId: seedId(`source:${source}`),
        entity,
        idempotencyKey: `seed-v1-${entity}`,
        format: "json",
        records,
      },
      ctx,
    );
  const base = (id: string) => ({
    sourceRecordId: id,
    sourceUpdatedAt: DEMO_TIME,
  });
  await load(
    "fleet",
    "vehicles",
    Array.from({ length: 12 }, (_, i) => ({
      ...base(`fleet-${i + 1}`),
      registration: `DEMO-${String(i + 1).padStart(3, "0")}`,
      code: `V-${String(i + 1).padStart(2, "0")}`,
      type: i < 8 ? "Rear loader" : "Compactor",
      capacityKg: i < 8 ? 9000 : 14000,
      mileageKm: 18400 + i * 2170,
      fuelLitres: 24 + i * 3.2,
      status:
        i === 10 || i === 11 ? "MAINTENANCE" : i < 8 ? "ON_ROUTE" : "AVAILABLE",
    })),
  );
  await load("weighbridge", "facilities", [
    {
      ...base("facility-transfer"),
      code: "F-01",
      name: "Central transfer station",
      type: "TRANSFER_STATION",
      location: "Poblacion industrial road",
      dailyCapacityKg: 160000,
    },
    {
      ...base("facility-recovery"),
      code: "F-02",
      name: "North materials recovery facility",
      type: "RECYCLING_FACILITY",
      location: "North district service road",
      dailyCapacityKg: 65000,
    },
    {
      ...base("facility-landfill"),
      code: "F-03",
      name: "San Isidro sanitary landfill",
      type: "LANDFILL",
      location: "Municipal disposal zone",
      dailyCapacityKg: 120000,
    },
  ]);
  const vehicles = await db.vehicle.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    }),
    facilities = await db.facility.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    });
  const routes: SeedRecord[] = [],
    weights: SeedRecord[] = [],
    recovery: SeedRecord[] = [];
  const routeNames = [
    "Poblacion east",
    "Poblacion west",
    "Riverside north",
    "Riverside south",
    "North market",
    "North residential",
    "Central commercial",
    "Public facilities",
  ];
  for (let day = 0; day < 7; day++) {
    const date = `2026-10-${20 + day}T06:00:00.000Z`;
    for (let i = 0; i < 8; i++) {
      const scheduled = 120 + i * 11,
        missed = (day * 3 + i * 2) % 9,
        remaining = day === 6 && i === 6 ? 17 : 0;
      routes.push({
        ...base(`route-${day}-${i}`),
        code: `R-${String(i + 1).padStart(2, "0")}`,
        name: routeNames[i]!,
        serviceAreaId: seedId(`area:${i % 3}`),
        vehicleId: vehicles[i]!.id,
        scheduledStops: scheduled,
        completedStops: scheduled - missed - remaining,
        missedStops: missed,
        scheduledAt: date,
        durationMinutes: day === 5 && i === 2 ? 645 : 180 + i * 18,
        status: remaining ? "IN_PROGRESS" : "COMPLETED",
      });
    }
    for (let i = 0; i < 6; i++) {
      const net = 4800 + day * 125 + i * 320;
      weights.push({
        ...base(`weight-${day}-${i}`),
        ticketNumber: `WB-${20 + day}-${String(i + 1).padStart(3, "0")}`,
        facilityId: facilities[0]!.id,
        materialTypeId: seedId(
          `material:${i < 3 ? "MIXED" : i === 3 ? "PAPER" : i === 4 ? "PLASTIC" : "METAL"}`,
        ),
        grossKg: net + 6400,
        tareKg: 6400,
        netKg: net,
        occurredAt: date,
      });
    }
    for (let i = 0; i < 3; i++) {
      const received = 2800 + day * 75 + i * 240;
      recovery.push({
        ...base(`recovery-${day}-${i}`),
        facilityId: facilities[1]!.id,
        materialTypeId: seedId(`material:${["PAPER", "PLASTIC", "METAL"][i]}`),
        receivedKg: received,
        recoveredKg: Math.round(received * (0.82 + i * 0.035)),
        contaminationPct: Math.round((10.5 - i * 2 + day * 0.35) * 10) / 10,
        occurredAt: date,
      });
    }
  }
  await load("collection", "routes", routes);
  await load("weighbridge", "weighbridge", weights);
  await load("recycling", "recycling", recovery);
  await load(
    "workorders",
    "work-orders",
    Array.from({ length: 5 }, (_, i) => ({
      ...base(`workorder-${i}`),
      reference: `WO-10${i + 1}`,
      title: [
        "Replace hydraulic hose",
        "Brake inspection",
        "Resolve GPS signal loss",
        "Preventive engine service",
        "Repair bin-lift sensor",
      ][i]!,
      vehicleId: vehicles[7 + i]!.id,
      assignee: ["Fleet workshop team A", "Fleet workshop team B"][i % 2]!,
      priority: i < 2 ? "ERROR" : "WARNING",
      status: i === 4 ? "COMPLETED" : i === 3 ? "IN_PROGRESS" : "OPEN",
      dueAt: `2026-10-${27 + i}T08:00:00Z`,
    })),
  );
  await load(
    "citizen",
    "citizen-requests",
    Array.from({ length: 8 }, (_, i) => ({
      ...base(`citizen-${i}`),
      reference: `CR-20${i + 1}`,
      category:
        i % 3 === 0 ? "Overflowing collection point" : "Missed collection",
      location: `${["Poblacion", "Riverside", "North district"][i % 3]} / block ${i + 1}`,
      citizenAlias: `Synthetic resident ${String(i + 1).padStart(3, "0")}`,
      status: i < 4 ? "OPEN" : i < 6 ? "ASSIGNED" : "RESOLVED",
      reportedAt: "2026-10-25T07:30:00Z",
      ...(i >= 6 ? { resolvedAt: "2026-10-26T04:00:00Z" } : {}),
    })),
  );
  await load(
    "contracts",
    "contracts",
    Array.from({ length: 3 }, (_, i) => ({
      ...base(`contract-${i}`),
      reference: `SC-2026-0${i + 1}`,
      vendor: [
        "Demo municipal collection cooperative",
        "Demo resource recovery services",
        "Demo district logistics",
      ][i]!,
      serviceAreaId: seedId(`area:${i}`),
      slaTargetPct: 98,
      ratePerTonne: 1100 + i * 125,
      validUntil: "2027-06-30T00:00:00Z",
    })),
  );
  const route = await db.collectionRoute.findFirstOrThrow({
    where: { organizationId },
  });
  await load("collection", "collection-events", [
    {
      ...base("collection-event-1"),
      routeId: route.id,
      vehicleId: vehicles[0]!.id,
      occurredAt: DEMO_TIME,
      status: "COMPLETED",
    },
  ]);
  await load("fleet", "telemetry", [
    {
      ...base("telemetry-1"),
      vehicleId: vehicles[0]!.id,
      occurredAt: DEMO_TIME,
      latitude: 14.5995,
      longitude: 120.9842,
      mileageKm: 18400,
      fuelLitres: 24,
    },
  ]);
  await db.collectionStop.upsert({
    where: { routeId_code: { routeId: route.id, code: "STOP-01" } },
    create: {
      organizationId,
      routeId: route.id,
      code: "STOP-01",
      location: "Synthetic public collection point",
      sequence: 1,
      status: "COMPLETED",
    },
    update: {},
  });
  // A deliberate quarantined demonstration, corrected by the integration desk.
  const invalid = {
    ...base("weight-demo-quarantine"),
    ticketNumber: "WB-QUARANTINE",
    facilityId: facilities[0]!.id,
    materialTypeId: seedId("material:MIXED"),
    grossKg: 12000,
    tareKg: 6500,
    netKg: -500,
    occurredAt: DEMO_TIME,
  };
  await executeImport(
    db,
    {
      sourceSystemId: seedId("source:weighbridge"),
      entity: "weighbridge",
      idempotencyKey: "seed-v1-quarantine",
      format: "json",
      records: [invalid],
    },
    ctx,
  );
  for (const [
    code,
    name,
    domain,
    entity,
    severity,
    description,
    checkId,
  ] of ruleDefinitions)
    await db.dQRule.upsert({
      where: { organizationId_code: { organizationId, code } },
      create: {
        id: seedId(`dq:${code}`),
        organizationId,
        code,
        name,
        domain,
        entity,
        severity,
        description,
        checkId,
        config:
          code === "OUTLIERS"
            ? {
                maxNetKg: 30000,
                minNetKg: 50,
                minDurationMinutes: 30,
                maxDurationMinutes: 600,
              }
            : {},
      },
      update: {},
    });
  if (!(await db.dQRun.count({ where: { organizationId } }))) {
    // Explicitly simulated source delays, so freshness warnings are grounded in data.
    await db.sourceSystem.update({
      where: { id: seedId("source:citizen") },
      data: { lastSuccessAt: new Date(Date.now() - 19 * 3600000) },
    });
    await executeQuality(db, ctx);
    await audit(db, {
      ...ctx,
      action: "DEMO_SEEDED",
      entity: "organization",
      entityId: organizationId,
      metadata: { synthetic: true, period: "2026-10-20/2026-10-26" },
    });
  }
}
