import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import request from "supertest";
import { DEMO_ORG, seed, seedId } from "../../prisma/seed.js";
import { createApp } from "../../src/app.js";
import { getConfig, isLoopback } from "../../src/config/env.js";
import {
  groupQuality,
  qualityPercentage,
} from "../../src/modules/insights/insights.service.js";
import {
  executeImport,
  retryImport,
  sourceLock,
} from "../../src/modules/integrations/integrations.service.js";
import { evaluateRule } from "../../src/modules/quality/quality.engine.js";
import { snapshot } from "../../src/modules/quality/quality.repository.js";

const url = new URL(process.env.DATABASE_URL!);
if (!isLoopback(url.hostname) || !url.pathname.startsWith("/waste_hub_test"))
  throw new Error(
    "Integration tests cannot target an application or remote database.",
  );
const db = new PrismaClient(),
  app = createApp(db, getConfig()),
  admin = request.agent(app),
  analyst = request.agent(app),
  operator = request.agent(app),
  password = process.env.SEED_PASSWORD!;
before(async () => {
  await seed(db, password);
  for (const [agent, email] of [
    [admin, "admin"],
    [analyst, "analyst"],
    [operator, "operator"],
  ] as const)
    await agent
      .post("/auth/login")
      .send({ email: `${email}@wastehub.demo`, password })
      .expect(200);
});
after(async () => {
  await db.$disconnect();
});
test("school quality trends include completed runs with findings, exclude execution failures and weight observations", async () => {
  await request(app).get("/insights/quality-trends").expect(401);
  await admin.get("/insights/quality-trends?limit=99").expect(422);
  const trends = (await analyst.get("/insights/quality-trends").expect(200))
    .body.data;
  assert.ok(trends.runs.length > 0);
  for (const run of trends.runs) {
    const stored = await db.dQRun.findUniqueOrThrow({ where: { id: run.id } });
    assert.equal(stored.organizationId, DEMO_ORG);
    assert.notEqual(stored.status, "FAILED");
    assert.equal(run.score, qualityPercentage(stored.checked, stored.failed));
  }
  assert.equal(qualityPercentage(0, 0), null);
  assert.equal(
    groupQuality([
      { checked: 1, failed: 1, rule: { domain: "collection" } },
      { checked: 99, failed: 0, rule: { domain: "collection" } },
    ])[0]!.score,
    99,
  );
  const selected = trends.runs[0];
  const snapshot = (
    await admin.get(`/dq/scorecards?runId=${selected.id}`).expect(200)
  ).body.data;
  assert.equal(snapshot.id, selected.id);
  await admin.get("/dq/scorecards?runId=not-an-id").expect(422);
});
test("collection reliability reports scoped counters, overdue routes and absent event evidence", async () => {
  await request(app).get("/insights/collection-reliability").expect(401);
  const base = await db.collectionRoute.findFirstOrThrow({
    where: { organizationId: DEMO_ORG },
  });
  const scheduledAt = new Date(Date.now() - 2 * 3600000);
  const route = await db.collectionRoute.create({
    data: {
      ...base,
      id: randomUUID(),
      sourceRecordId: `school-${randomUUID()}`,
      code: "SCHOOL-ROUTE",
      name: "Synthetic presentation route",
      scheduledAt,
      durationMinutes: 30,
      status: "IN_PROGRESS",
      vehicleId: null,
      scheduledStops: 10,
      completedStops: 5,
      missedStops: 2,
      archivedAt: null,
    },
  });
  const date = scheduledAt.toISOString().slice(0, 10),
    query = `from=${date}&to=${date}&pageSize=100&areaId=${route.serviceAreaId}`;
  const report = (
    await analyst.get(`/insights/collection-reliability?${query}`).expect(200)
  ).body;
  const row = report.data.find((r: { id: string }) => r.id === route.id);
  assert.equal(row.overdue, true);
  assert.equal(row.eventCount, 0);
  assert.equal(row.vehicle, null);
  assert.ok(
    row.findings.some((s: string) =>
      s.includes("No collection-event evidence"),
    ),
  );
  assert.equal(
    report.summary.completionPct,
    Math.round(
      (report.summary.completedStops / report.summary.scheduledStops) * 10000,
    ) / 100,
  );
  const future = await db.collectionRoute.create({
    data: {
      ...base,
      id: randomUUID(),
      sourceRecordId: `school-future-${randomUUID()}`,
      code: "SCHOOL-FUTURE",
      scheduledAt: new Date(scheduledAt.getTime() + 86400000),
      durationMinutes: 30,
      status: "SCHEDULED",
      archivedAt: null,
    },
  });
  const futureDate = future.scheduledAt.toISOString().slice(0, 10),
    futureReport = (
      await admin
        .get(
          `/insights/collection-reliability?from=${futureDate}&to=${futureDate}&pageSize=100`,
        )
        .expect(200)
    ).body;
  assert.equal(
    futureReport.data.find((r: { id: string }) => r.id === future.id).overdue,
    false,
  );
  await db.collectionRoute.update({
    where: { id: route.id },
    data: { status: "COMPLETED", missedStops: 5 },
  });
  const reconciled = (
    await admin.get(`/insights/collection-reliability?${query}`).expect(200)
  ).body.data.find((r: { id: string }) => r.id === route.id);
  assert.ok(
    !reconciled.findings.some((f: string) => f.includes("reconciliation")),
    "A finished route with accounted-for missed stops is valid",
  );
  await db.collectionRoute.update({
    where: { id: route.id },
    data: { archivedAt: new Date() },
  });
  const after = (
    await admin.get(`/insights/collection-reliability?${query}`).expect(200)
  ).body;
  assert.equal(after.summary.routes, report.summary.routes - 1);
  await admin
    .get(`/insights/collection-reliability?areaId=${randomUUID()}`)
    .expect(404);
  await admin
    .get("/insights/collection-reliability?from=2026-10-10&to=2026-10-01")
    .expect(422);
  await db.collectionRoute.update({
    where: { id: future.id },
    data: { archivedAt: new Date() },
  });
});
test("health, readiness, error envelopes, input validation and security headers", async () => {
  const health = await request(app).get("/health").expect(200);
  assert.equal(health.body.status, "ok");
  assert.equal(health.headers["x-content-type-options"], "nosniff");
  await request(app).get("/ready").expect(200);
  const noAuth = await request(app).get("/operations/routes").expect(401);
  assert.equal(noAuth.body.error.code, "UNAUTHENTICATED");
  assert.ok(noAuth.body.error.requestId);
  await admin.get("/operations/routes?page=-1").expect(422);
  await admin.get("/operations/routes/not-a-uuid").expect(422);
  const missing = await admin.get("/not-a-route").expect(404);
  assert.equal(missing.body.error.code, "NOT_FOUND");
  await admin
    .post("/dq/runs")
    .set("Origin", "https://untrusted.example")
    .send({})
    .expect(403);
});
test("backend authorization protects ingestion, governance, audits and quality execution", async () => {
  await analyst.post("/integrations/imports").send({}).expect(403);
  await analyst.post("/dq/runs").send({}).expect(403);
  await analyst.get("/audit-events").expect(403);
  await operator
    .patch(`/governance/assets/${randomUUID()}`)
    .send({})
    .expect(403);
  await analyst
    .get("/operations/citizen-requests")
    .expect(200)
    .then((r) =>
      assert.ok(
        r.body.data.every(
          (row: Record<string, unknown>) => !("citizenAlias" in row),
        ),
      ),
    );
});
test("dashboard values and report rows are backed by canonical database records", async () => {
  const response = await admin.get("/overview").expect(200),
    data = response.body.data;
  const aggregate = await db.collectionRoute.aggregate({
    where: { organizationId: DEMO_ORG, archivedAt: null },
    _sum: { completedStops: true, scheduledStops: true, missedStops: true },
  });
  assert.equal(data.totals.completed, aggregate._sum.completedStops);
  assert.equal(data.totals.missed, aggregate._sum.missedStops);
  assert.equal(data.sources.length, 7);
  assert.equal(data.demoMode, true);
  const report = await admin.get("/reports/operations").expect(200);
  assert.equal(report.body.data.rows.length, 56);
  await admin
    .get("/reports/operations?from=2026-10-27&to=2026-10-20")
    .expect(422);
});
test("CSV imports are idempotent, quarantine invalid records and retry only failures", async () => {
  const suffix = randomUUID().slice(0, 8),
    sourceSystemId = seedId("source:fleet"),
    key = randomUUID();
  const csv = `sourceRecordId,sourceUpdatedAt,registration,code,type,capacityKg,mileageKm,fuelLitres,status\nunit-${suffix}-ok,2026-10-26T08:00:00Z,LOCAL-${suffix},V-${suffix},Rear loader,9000,1200,30,AVAILABLE\nunit-${suffix}-bad,2026-10-26T08:00:00Z,,V-B-${suffix},Rear loader,9000,1200,30,AVAILABLE`;
  const body = { sourceSystemId, idempotencyKey: key, format: "csv", csv };
  const first = await operator
      .post("/integrations/imports")
      .send(body)
      .expect(201),
    run = first.body.data;
  assert.equal(run.processed, 1);
  assert.equal(run.failed, 1);
  assert.equal(run.status, "PARTIAL");
  const successful = await db.vehicle.findFirstOrThrow({
    where: { organizationId: DEMO_ORG, sourceRecordId: `unit-${suffix}-ok` },
  });
  const replay = await operator
    .post("/integrations/imports")
    .send(body)
    .expect(201);
  assert.equal(replay.body.data.id, run.id);
  assert.equal(replay.body.data.replayed, true);
  await operator
    .post("/integrations/imports")
    .send({ ...body, csv: csv + "\n" })
    .expect(201); // Equivalent parsed rows retain the same payload hash.
  await operator
    .post("/integrations/imports")
    .send({ ...body, csv: csv.replace("9000", "8000") })
    .expect(409);
  assert.equal(
    await db.vehicle.count({
      where: { organizationId: DEMO_ORG, sourceRecordId: `unit-${suffix}-ok` },
    }),
    1,
  );
  const detail = await operator.get(`/integrations/runs/${run.id}`).expect(200),
    error = detail.body.data.errors[0];
  assert.match(error.message, /registration/);
  const payload = {
    ...error.rawRecord.payload,
    registration: `FIXED-${suffix}`,
  };
  const retried = await operator
    .post(`/integrations/runs/${run.id}/retry`)
    .send({ corrections: [{ errorId: error.id, payload }] })
    .expect(200);
  assert.equal(retried.body.data.failed, 0);
  assert.equal(retried.body.data.processed, 2);
  const unchanged = await db.vehicle.findUniqueOrThrow({
    where: { id: successful.id },
  });
  assert.equal(
    unchanged.updatedAt.toISOString(),
    successful.updatedAt.toISOString(),
  );
  assert.equal(
    (
      await db.integrationRecordError.findUniqueOrThrow({
        where: { id: error.id },
      })
    ).remediation,
    "RESOLVED",
  );
  const newReplay = await operator
    .post("/integrations/imports")
    .send({ ...body, idempotencyKey: randomUUID() })
    .expect(201);
  assert.equal(newReplay.body.data.skipped, 1);
});
test("tenant isolation protects reads, imports, and direct canonical foreign references", async () => {
  const otherOrg = randomUUID(),
    otherSource = randomUUID();
  await db.organization.create({
    data: { id: otherOrg, name: "Other test municipality" },
  });
  await db.sourceSystem.create({
    data: {
      id: otherSource,
      organizationId: otherOrg,
      code: "other",
      name: "Other source",
      entity: "facilities",
      domain: "materials",
      method: "CSV",
    },
  });
  const facility = await db.facility.create({
    data: {
      organizationId: otherOrg,
      sourceSystemId: otherSource,
      sourceRecordId: "other-facility",
      sourceUpdatedAt: new Date(),
      sourceVersion: "v1",
      code: "OTHER-F",
      name: "Other facility",
      type: "TRANSFER_STATION",
      location: "Synthetic other municipality",
      dailyCapacityKg: 1000,
    },
  });
  await admin.get(`/operations/facilities/${facility.id}`).expect(404);
  await admin.get(`/integrations/runs/${randomUUID()}`).expect(404);
  const materials = await db.materialType.findFirstOrThrow({
    where: { organizationId: DEMO_ORG },
  });
  const payload = {
    sourceRecordId: "cross-tenant-attempt",
    sourceUpdatedAt: "2026-10-26T08:00:00Z",
    ticketNumber: "CROSS-TENANT",
    facilityId: facility.id,
    materialTypeId: materials.id,
    grossKg: 9000,
    tareKg: 4000,
    netKg: 5000,
    occurredAt: "2026-10-26T08:00:00Z",
  };
  const quarantined = await admin
    .post("/integrations/imports")
    .send({
      sourceSystemId: seedId("source:weighbridge"),
      idempotencyKey: randomUUID(),
      format: "json",
      records: [payload],
    })
    .expect(201);
  assert.equal(quarantined.body.data.failed, 1);
  await assert.rejects(
    db.weighbridgeTransaction.create({
      data: {
        ...payload,
        sourceUpdatedAt: new Date(payload.sourceUpdatedAt),
        occurredAt: new Date(payload.occurredAt),
        organizationId: DEMO_ORG,
        sourceSystemId: seedId("source:weighbridge"),
        sourceVersion: "v1",
      },
    }),
  );
});
test("quality rules persist fourteen results and remediation does not rewrite a score", async () => {
  const run = await operator.post("/dq/runs").send({}).expect(201);
  const id = run.body.data.id;
  assert.equal(
    await db.dQResult.count({ where: { runId: id, organizationId: DEMO_ORG } }),
    14,
  );
  const score = await admin.get("/dq/scorecards").expect(200),
    results = score.body.data.results;
  assert.equal(score.body.data.id, id);
  assert.ok(
    results.some(
      (r: {
        rule: {
          code: string;
        };
        failed: number;
      }) => r.rule.code === "OUTLIERS" && r.failed > 0,
    ),
  );
  const result = results.find((r: { failed: number }) => r.failed > 0);
  await operator
    .patch(`/dq/results/${result.id}`)
    .send({
      remediation: "ACKNOWLEDGED",
      note: "Local acceptance verification reviewed the sample.",
    })
    .expect(200);
  assert.equal(
    (await db.dQRun.findUniqueOrThrow({ where: { id } })).score,
    run.body.data.score,
  );
});
test("governance uses version checks, forbids public PII, and writes immutable audit events", async () => {
  const asset = await db.dataAsset.findFirstOrThrow({
      where: { organizationId: DEMO_ORG, containsPii: true },
    }),
    payload = {
      owner: asset.owner,
      steward: asset.steward,
      classification: "CONFIDENTIAL",
      retentionDays: 400,
      policy: asset.policy,
      reason: "Local retention policy review.",
      version: asset.version,
    };
  await admin
    .patch(`/governance/assets/${asset.id}`)
    .send({ ...payload, classification: "PUBLIC" })
    .expect(422);
  await admin.patch(`/governance/assets/${asset.id}`).send(payload).expect(200);
  await admin.patch(`/governance/assets/${asset.id}`).send(payload).expect(409);
  const event = await db.auditEvent.findFirstOrThrow({
    where: {
      organizationId: DEMO_ORG,
      action: "GOVERNANCE_ASSET_CHANGED",
      entityId: asset.id,
    },
  });
  await assert.rejects(
    db.auditEvent.update({
      where: { id: event.id },
      data: { reason: "Tamper attempt" },
    }),
  );
  await assert.rejects(db.auditEvent.delete({ where: { id: event.id } }));
});
test("CSV report exports are audited, and session rotation invalidates old cookies", async () => {
  const exported = await admin.get("/reports/diversion?format=csv").expect(200);
  assert.match(exported.headers["content-type"] ?? "", /text\/csv/);
  assert.match(exported.text, /receivedKg/);
  assert.ok(
    await db.auditEvent.count({
      where: { organizationId: DEMO_ORG, action: "REPORT_EXPORTED" },
    }),
  );
  const login = await request(app)
    .post("/auth/login")
    .send({ email: "admin@wastehub.demo", password })
    .expect(200);
  const oldCookie = String(login.headers["set-cookie"]?.[0] ?? "").split(
    ";",
  )[0]!;
  assert.ok(oldCookie);
  const rotated = await request(app)
    .post("/auth/refresh")
    .set("Cookie", oldCookie)
    .send({})
    .expect(200);
  const newCookie = String(rotated.headers["set-cookie"]?.[0] ?? "").split(
    ";",
  )[0]!;
  assert.ok(newCookie);
  assert.notEqual(oldCookie, newCookie);
  await request(app).get("/auth/me").set("Cookie", oldCookie).expect(401);
  await request(app).get("/auth/me").set("Cookie", newCookie).expect(200);
  await request(app)
    .post("/auth/logout")
    .set("Cookie", newCookie)
    .send({})
    .expect(204);
  await request(app).get("/auth/me").set("Cookie", newCookie).expect(401);
});
test("each of the fourteen DQM rules accepts clean data and detects a specific defect", async (t) => {
  const base = await snapshot(db, DEMO_ORG),
    now = new Date("2026-10-27T08:00:00Z");
  const good: Awaited<ReturnType<typeof snapshot>> = {
    ...base,
    routes: [
      {
        ...base.routes[0]!,
        code: "R-CLEAN",
        name: "Clean route",
        scheduledStops: 100,
        completedStops: 100,
        missedStops: 0,
        status: "COMPLETED" as const,
        durationMinutes: 240,
      },
    ],
    vehicles: [base.vehicles[0]!],
    facilities: [base.facilities[0]!],
    weights: [base.weights[0]!],
    recycling: [base.recycling[0]!],
    events: [
      {
        ...base.events[0]!,
        routeId: base.routes[0]!.id,
        vehicleId: base.vehicles[0]!.id,
      },
    ],
    requests: [
      {
        ...base.requests[0]!,
        previousStatus: null,
        status: "OPEN" as const,
        resolvedAt: null,
      },
    ],
    raw: [
      {
        id: randomUUID(),
        runId: "clean-batch",
        sourceRecordId: "clean-source-record",
      },
    ],
    sources: base.sources.map((s) => ({ ...s, lastSuccessAt: now })),
    assets: base.assets,
    telemetry: [],
    workOrders: [],
    contracts: [],
  };
  type Fixture = typeof good;
  const cases: {
    code: string;
    check: string;
    defect: (s: Fixture) => void;
  }[] = [
    {
      code: "COMPLETENESS",
      check: "completeness",
      defect: (s) => {
        s.routes[0]!.name = "   ";
      },
    },
    {
      code: "TIMESTAMPS",
      check: "timestamps",
      defect: (s) => {
        s.vehicles[0]!.sourceUpdatedAt = new Date("1999-01-01T00:00:00Z");
      },
    },
    {
      code: "NON_NEGATIVE",
      check: "nonNegative",
      defect: (s) => {
        s.routes[0]!.durationMinutes = -5;
      },
    },
    {
      code: "MATERIAL_REFERENCE",
      check: "materials",
      defect: (s) => {
        s.weights[0]!.materialTypeId = randomUUID();
      },
    },
    {
      code: "SOURCE_DUPLICATES",
      check: "duplicates",
      defect: (s) => {
        s.raw = [
          {
            id: randomUUID(),
            runId: "duplicate-batch",
            sourceRecordId: "same",
          },
          {
            id: randomUUID(),
            runId: "duplicate-batch",
            sourceRecordId: "same",
          },
        ] as Fixture["raw"];
      },
    },
    {
      code: "VEHICLE_IDENTIFIERS",
      check: "vehicles",
      defect: (s) => {
        s.vehicles.push({
          ...s.vehicles[0]!,
          id: randomUUID(),
          registration: s.vehicles[0]!.registration.toLowerCase(),
          code: "V-OTHER",
        });
      },
    },
    {
      code: "EVENT_REFERENCES",
      check: "references",
      defect: (s) => {
        s.events = [
          { ...base.events[0]!, routeId: randomUUID() },
        ] as Fixture["events"];
      },
    },
    {
      code: "COLLECTION_STATUS",
      check: "collection",
      defect: (s) => {
        s.routes[0]!.completedStops = 101;
      },
    },
    {
      code: "NET_WEIGHT",
      check: "netWeight",
      defect: (s) => {
        s.weights[0]!.netKg += 100;
      },
    },
    {
      code: "RECOVERY_BALANCE",
      check: "recovery",
      defect: (s) => {
        s.recycling[0]!.recoveredKg = s.recycling[0]!.receivedKg + 10;
        s.recycling[0]!.exceptionReason = null;
      },
    },
    {
      code: "REQUEST_TRANSITIONS",
      check: "transitions",
      defect: (s) => {
        s.requests[0] = {
          ...s.requests[0]!,
          previousStatus: "OPEN",
          status: "CLOSED",
          resolvedAt: now,
        } as Fixture["requests"][number];
      },
    },
    {
      code: "SOURCE_FRESHNESS",
      check: "freshness",
      defect: (s) => {
        s.sources[0]!.lastSuccessAt = new Date(now.getTime() - 500 * 3600000);
      },
    },
    {
      code: "OUTLIERS",
      check: "outliers",
      defect: (s) => {
        s.routes[0]!.durationMinutes = 601;
      },
    },
    {
      code: "CLASSIFICATION",
      check: "classification",
      defect: (s) => {
        s.assets = [
          { ...s.assets[0]!, containsPii: true, classification: "PUBLIC" },
        ];
      },
    },
  ];
  for (const c of cases)
    await t.test(c.code, () => {
      const clean = evaluateRule(c.check, good, {}, now);
      assert.ok(
        clean.checked > 0,
        `${c.code} must evaluate real clean observations`,
      );
      assert.equal(clean.failed, 0, "clean data must pass");
      const bad = structuredClone(good);
      c.defect(bad);
      const result = evaluateRule(c.check, bad, {}, now);
      assert.ok(result.failed > 0, `${c.code} must detect the defect`);
      assert.ok(result.samples.length > 0 && result.samples.length <= 5);
      assert.ok(result.samples.every((s) => s.id && s.reason));
    });
});
const regressionContext = {
  organizationId: DEMO_ORG,
  actorName: "Local acceptance demo",
  requestId: "local-expanded-regression",
};
test("duplicate CSV headers are rejected before a run can silently replace a field", async () => {
  await assert.rejects(
    executeImport(
      db,
      {
        sourceSystemId: seedId("source:fleet"),
        idempotencyKey: randomUUID(),
        format: "csv",
        csv: "sourceRecordId,sourceUpdatedAt,registration,code,type,capacityKg,capacityKg,mileageKm,fuelLitres,status\nduplicate-header,2026-10-26T08:00:00Z,DUP-HEADER,V-DUP,Rear loader,9000,0,100,20,AVAILABLE",
      },
      regressionContext,
    ),
    { code: "INVALID_CSV" },
  );
});
test("a disabled adapter cannot run just because another source connection is enabled", async () => {
  const sourceSystemId = seedId("source:contracts");
  await db.integrationConnection.update({
    where: { sourceSystemId_adapter: { sourceSystemId, adapter: "mock" } },
    data: { enabled: false },
  });
  try {
    await assert.rejects(
      executeImport(
        db,
        { sourceSystemId, idempotencyKey: randomUUID(), format: "mock" },
        regressionContext,
      ),
      { code: "SOURCE_DISABLED" },
    );
  } finally {
    await db.integrationConnection.update({
      where: { sourceSystemId_adapter: { sourceSystemId, adapter: "mock" } },
      data: { enabled: true },
    });
  }
});
test("replaying a duplicate row cannot overwrite the successful row in that same batch", async () => {
  const tag = randomUUID().slice(0, 8),
    row = {
      sourceRecordId: `dup-${tag}`,
      sourceUpdatedAt: "2026-10-26T08:00:00Z",
      registration: `DUP-${tag}`,
      code: `DUP-${tag}`,
      type: "Rear loader",
      capacityKg: 9000,
      mileageKm: 100,
      fuelLitres: 20,
      status: "AVAILABLE",
    };
  const run = await executeImport(
    db,
    {
      sourceSystemId: seedId("source:fleet"),
      idempotencyKey: randomUUID(),
      format: "json",
      records: [row, { ...row, capacityKg: 100 }],
    },
    regressionContext,
  );
  assert.equal(run.processed, 1);
  assert.equal(run.failed, 1);
  const retried = await retryImport(db, run.id, [], regressionContext);
  assert.equal(retried.failed, 1);
  const vehicle = await db.vehicle.findFirstOrThrow({
    where: { organizationId: DEMO_ORG, sourceRecordId: row.sourceRecordId },
  });
  assert.equal(vehicle.capacityKg, 9000);
});
test("DQM run stores an independently verifiable score and does not overlap an active run", async () => {
  const response = await admin.post("/dq/runs").send({}).expect(201),
    runId = response.body.data.id;
  const results = await db.dQResult.findMany({ where: { runId } });
  const checked = results.reduce((n, r) => n + r.checked, 0),
    failed = results.reduce((n, r) => n + r.failed, 0);
  assert.equal(response.body.data.checked, checked);
  assert.equal(response.body.data.failed, failed);
  assert.equal(
    response.body.data.score,
    Math.round(((checked - failed) / checked) * 10000) / 100,
  );
  const blocking = await db.dQRun.create({
    data: {
      organizationId: DEMO_ORG,
      initiatedBy: "Synthetic active-run fixture",
    },
  });
  try {
    await admin.post("/dq/runs").send({}).expect(409);
  } finally {
    await db.dQRun.update({
      where: { id: blocking.id },
      data: { status: "FAILED", finishedAt: new Date() },
    });
  }
});
test("source locks reject concurrent ingestion and release after failure", async () => {
  const sourceId = seedId("source:fleet");
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
      entered = resolve;
    }),
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
  const first = sourceLock(db, DEMO_ORG, sourceId, async () => {
    entered();
    await hold;
    throw new Error("Synthetic worker error");
  });
  await started;
  try {
    await assert.rejects(
      sourceLock(db, DEMO_ORG, sourceId, async () => true),
      { code: "SOURCE_BUSY" },
    );
  } finally {
    release();
  }
  await assert.rejects(first, /Synthetic worker error/);
  assert.equal(
    await db.integrationLock.count({ where: { sourceSystemId: sourceId } }),
    0,
  );
});
test("API boundaries reject malformed JSON, oversized bodies, cross-site writes and unsupported media", async () => {
  const malformed = await admin
    .post("/dq/runs")
    .set("Content-Type", "application/json")
    .send('{"broken":')
    .expect(400);
  assert.equal(malformed.body.error.code, "INVALID_JSON");
  await admin
    .post("/dq/runs")
    .set("Content-Type", "text/plain")
    .send("not json")
    .expect(415);
  await admin
    .post("/dq/runs")
    .set("Sec-Fetch-Site", "cross-site")
    .send({})
    .expect(403);
  const huge = await admin
    .post("/integrations/imports")
    .send({ csv: "x".repeat(2 * 1024 * 1024 + 1) })
    .expect(413);
  assert.equal(huge.body.error.code, "REQUEST_TOO_LARGE");
  await admin
    .get("/reports/operations?from=2020-01-01&to=2026-10-26")
    .expect(422);
  const headers = (await admin.get("/auth/me")).headers;
  assert.match(headers["cache-control"] ?? "", /no-store/);
  assert.ok(headers["x-request-id"]);
});
test("authentication throttling stops repeated invalid requests with a consistent error", async () => {
  const limitedApp = createApp(db, getConfig());
  for (let index = 0; index < 20; index++)
    await request(limitedApp)
      .post("/auth/login")
      .send({ email: "invalid", password: "invalid" })
      .expect(422);
  const blocked = await request(limitedApp)
    .post("/auth/login")
    .send({ email: "invalid", password: "invalid" })
    .expect(429);
  assert.equal(blocked.body.error.code, "RATE_LIMITED");
  assert.ok(blocked.headers["retry-after"]);
});
test("production session cookies are HTTP-only, Secure and SameSite=Strict", async () => {
  const productionApp = createApp(db, {
    ...getConfig(),
    NODE_ENV: "production",
    WEB_ORIGIN: "https://wastehub.example",
  });
  const login = await request(productionApp)
    .post("/auth/login")
    .send({ email: "admin@wastehub.demo", password })
    .expect(200);
  const cookie = String(login.headers["set-cookie"]?.[0] ?? "");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
});
test("DQM execution fails closed for an unsupported check and audits the failed run", async () => {
  const rule = await db.dQRule.create({
    data: {
      organizationId: DEMO_ORG,
      code: "LOCAL_UNKNOWN_CHECK",
      name: "Invalid executable fixture",
      domain: "Operations",
      entity: "multi",
      severity: "ERROR",
      description: "Local test of a misconfigured executable identifier",
      checkId: "unregistered-executable",
      config: {},
    },
  });
  try {
    await admin.post("/dq/runs").send({}).expect(422);
    const failed = await db.dQRun.findFirstOrThrow({
      where: { organizationId: DEMO_ORG, status: "FAILED" },
      orderBy: { startedAt: "desc" },
    });
    assert.ok(
      await db.auditEvent.count({
        where: {
          organizationId: DEMO_ORG,
          entityId: failed.id,
          action: "DQ_FAILED",
        },
      }),
    );
  } finally {
    await db.dQRule.update({ where: { id: rule.id }, data: { active: false } });
  }
});
test("school presentation users enforce admin access, tenant isolation, safe responses and session revocation", async () => {
  await request(app).get("/users").expect(401);
  await operator.get("/users").expect(403);
  await operator.get("/users/roles").expect(403);
  const roles = (await admin.get("/users/roles").expect(200)).body.data;
  const role = roles.find((r: { code: string }) => r.code === "analyst");
  const email = `student-${randomUUID()}@wastehub.demo`,
    password = process.env.SEED_PASSWORD!;
  const created = (
    await admin
      .post("/users")
      .send({
        name: "Presentation learner",
        email,
        password,
        roleId: role.id,
        reason: "Create isolated local presentation account",
      })
      .expect(201)
  ).body.data;
  assert.ok(!JSON.stringify(created).includes("password"));
  await admin
    .post("/users")
    .send({
      name: "Duplicate learner",
      email,
      password,
      roleId: role.id,
      reason: "Duplicate email should be rejected",
    })
    .expect(409);
  const student = request.agent(app);
  const studentLogin = await student
    .post("/auth/login")
    .send({ email, password })
    .expect(200);
  assert.equal(studentLogin.body.data.roleCode, "analyst");
  await student.get("/users").expect(403);
  const changed = (
    await admin
      .patch(`/users/${created.id}`)
      .send({
        name: created.name,
        roleId: role.id,
        active: false,
        updatedAt: created.updatedAt,
        reason: "Deactivate account and revoke local sessions",
      })
      .expect(200)
  ).body.data;
  await student.get("/auth/me").expect(401);
  await student.post("/auth/login").send({ email, password }).expect(401);
  await admin
    .patch(`/users/${created.id}`)
    .send({
      name: created.name,
      roleId: role.id,
      active: true,
      updatedAt: created.updatedAt,
      reason: "Reject an outdated edit of this account",
    })
    .expect(409);
  const me = await db.user.findUniqueOrThrow({
    where: { id: seedId("user:admin") },
  });
  await admin
    .patch(`/users/${me.id}`)
    .send({
      name: me.name,
      roleId: role.id,
      active: false,
      updatedAt: me.updatedAt.toISOString(),
      reason: "Prevent accidental administrator lockout",
    })
    .expect(409);
  const other = await db.organization.create({
      data: { name: "Isolated presentation district" },
    }),
    foreignRole = await db.role.create({
      data: {
        organizationId: other.id,
        code: "admin",
        name: "Foreign administrator",
      },
    });
  await admin
    .patch(`/users/${changed.id}`)
    .send({
      name: changed.name,
      roleId: foreignRole.id,
      active: true,
      updatedAt: changed.updatedAt,
      reason: "Foreign roles must not cross district boundaries",
    })
    .expect(422);
  const list = await admin.get("/users").expect(200);
  assert.ok(!JSON.stringify(list.body).includes("passwordHash"));
  const event = await db.auditEvent.findFirstOrThrow({
    where: { entityId: created.id, action: "USER_UPDATED" },
  });
  assert.equal(event.reason, "Deactivate account and revoke local sessions");
  assert.ok(!JSON.stringify(event).includes(password));
});

test("administrator-assisted recovery enforces verification, single use, expiry and session revocation", async () => {
  const role = await db.role.findFirstOrThrow({
    where: { organizationId: DEMO_ORG, code: "analyst" },
  });
  const email = `recovery-${randomUUID()}@example.test`,
    oldPassword = `old-${randomUUID()}`,
    newPassword = `new-${randomUUID()}`;
  const created = await admin
    .post("/users")
    .send({
      name: "Recovery Test",
      email,
      password: oldPassword,
      roleId: role.id,
      reason: "Create isolated recovery test",
    })
    .expect(201);
  const target = created.body.data;
  const recipient = request.agent(app);
  await recipient
    .post("/auth/login")
    .send({ email, password: oldPassword })
    .expect(200);
  const issue = {
    administratorPassword: process.env.SEED_PASSWORD,
    verificationMethod: "Verified in person",
    reason: "Recover account after identity verification",
    verified: true,
  };
  await request(app)
    .post(`/users/${target.id}/recovery`)
    .send(issue)
    .expect(401);
  await analyst.post(`/users/${target.id}/recovery`).send(issue).expect(403);
  await admin
    .post(`/users/${target.id}/recovery`)
    .send({ ...issue, administratorPassword: `wrong-${randomUUID()}` })
    .expect(401);
  await admin
    .post(`/users/${target.id}/recovery`)
    .send({ ...issue, verified: false })
    .expect(422);
  const foreignOrganization = await db.organization.create({
    data: { name: "Other recovery tenant" },
  });
  const foreignRole = await db.role.create({
    data: {
      organizationId: foreignOrganization.id,
      code: "foreign",
      name: "Other role",
    },
  });
  const { hashPassword } = await import("../../src/shared/security.js");
  const foreignUser = await db.user.create({
    data: {
      organizationId: foreignOrganization.id,
      roleId: foreignRole.id,
      name: "Foreign account",
      email: `foreign-${randomUUID()}@example.test`,
      passwordHash: await hashPassword(oldPassword),
    },
  });
  await admin.post(`/users/${foreignUser.id}/recovery`).send(issue).expect(404);
  const response = await admin
    .post(`/users/${target.id}/recovery`)
    .send(issue)
    .expect(201);
  const code = response.body.data.code;
  assert.ok(code && response.headers["cache-control"]?.includes("no-store"));
  const stored = await db.passwordRecovery.findFirstOrThrow({
    where: { userId: target.id, usedAt: null },
  });
  assert.notEqual(stored.tokenHash, code);
  await request(app)
    .post("/auth/recover")
    .send({ code, password: newPassword })
    .expect(204);
  await recipient.get("/auth/me").expect(401);
  await request(app)
    .post("/auth/recover")
    .send({ code, password: newPassword })
    .expect(400);
  await request(app)
    .post("/auth/login")
    .send({ email, password: oldPassword })
    .expect(401);
  await request(app)
    .post("/auth/login")
    .send({ email, password: newPassword })
    .expect(200);
  const expiredCode = "expired-test-code-012345678901234567890123456789";
  const { tokenHash } = await import("../../src/shared/security.js");
  await db.passwordRecovery.create({
    data: {
      userId: target.id,
      tokenHash: tokenHash(expiredCode),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await request(app)
    .post("/auth/recover")
    .send({ code: expiredCode, password: newPassword })
    .expect(400);
  const second = await admin
    .post(`/users/${target.id}/recovery`)
    .send(issue)
    .expect(201);
  const simultaneous = await Promise.all(
    [0, 1].map(() =>
      request(app)
        .post("/auth/recover")
        .send({ code: second.body.data.code, password: newPassword }),
    ),
  );
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [204, 400]);
  const events = await db.auditEvent.findMany({
    where: {
      entityId: target.id,
      action: {
        in: ["PASSWORD_RECOVERY_ISSUED", "PASSWORD_RECOVERY_COMPLETED"],
      },
    },
  });
  assert.equal(events.length, 4);
  assert.ok(!JSON.stringify(events).includes(code));
});

test("security questions protect password changes and administrator resets", async () => {
  const isolatedApp = createApp(db, getConfig()),
    manager = request.agent(isolatedApp),
    reader = request.agent(isolatedApp),
    person = request.agent(isolatedApp);
  const seedPassword = process.env.SEED_PASSWORD!;
  await manager
    .post("/auth/login")
    .send({ email: "admin@wastehub.demo", password: seedPassword })
    .expect(200);
  await reader
    .post("/auth/login")
    .send({ email: "analyst@wastehub.demo", password: seedPassword })
    .expect(200);
  const role = await db.role.findFirstOrThrow({
    where: { organizationId: DEMO_ORG, code: "analyst" },
  });
  const email = `question-${randomUUID()}@example.test`,
    original = `old-${randomUUID()}`,
    replacement = `new-${randomUUID()}`,
    answer = `answer-${randomUUID()}`,
    nextAnswer = `next-${randomUUID()}`;
  const created = await manager
    .post("/users")
    .send({
      name: "Question test",
      email,
      password: original,
      roleId: role.id,
      reason: "Create isolated question test",
    })
    .expect(201);
  const id = created.body.data.id;
  await person
    .post("/auth/login")
    .send({ email, password: original })
    .expect(200);
  await request(isolatedApp).get("/auth/security-question").expect(401);
  assert.equal(
    (await person.get("/auth/security-question").expect(200)).body.data,
    null,
  );
  const setup = {
    currentPassword: original,
    question: "What is your private test phrase?",
    answer,
  };
  await person.put("/auth/security-question").send(setup).expect(204);
  const stored = await db.securityQuestion.findUniqueOrThrow({
    where: { userId: id },
  });
  assert.notEqual(stored.answerHash, answer);
  const questionResponse = await person
    .get("/auth/security-question")
    .expect(200);
  assert.equal(questionResponse.body.data.question, setup.question);
  assert.ok(!JSON.stringify(questionResponse.body).includes(answer));
  await person
    .post("/auth/change-password")
    .send({
      currentPassword: original,
      newPassword: replacement,
      answer: `wrong-${randomUUID()}`,
    })
    .expect(401);
  await person
    .post("/auth/change-password")
    .send({
      currentPassword: `wrong-${randomUUID()}`,
      newPassword: replacement,
      answer,
    })
    .expect(401);
  await person
    .post("/auth/change-password")
    .send({ currentPassword: original, newPassword: replacement, answer })
    .expect(204);
  await person.get("/auth/me").expect(401);
  await person
    .post("/auth/login")
    .send({ email, password: original })
    .expect(401);
  await person
    .post("/auth/login")
    .send({ email, password: replacement })
    .expect(200);
  await person
    .put("/auth/security-question")
    .send({
      currentPassword: replacement,
      question: setup.question,
      answer: nextAnswer,
    })
    .expect(401);
  const reset = {
    administratorPassword: seedPassword,
    verificationMethod: "Verified in person",
    reason: "Reset verified account question",
    verified: true,
    question: "What is your new test phrase?",
    answer: nextAnswer,
  };
  await reader.put(`/users/${id}/security-question`).send(reset).expect(403);
  await manager
    .put(`/users/${id}/security-question`)
    .send({ ...reset, administratorPassword: `wrong-${randomUUID()}` })
    .expect(401);
  const foreign = await db.user.findFirstOrThrow({
    where: { organization: { name: "Other recovery tenant" } },
  });
  await manager
    .put(`/users/${foreign.id}/security-question`)
    .send(reset)
    .expect(404);
  const pending = await manager
    .post(`/users/${id}/recovery`)
    .send({
      administratorPassword: seedPassword,
      verificationMethod: "Verified in person",
      reason: "Test invalidation of recovery code",
      verified: true,
    })
    .expect(201);
  await manager.put(`/users/${id}/security-question`).send(reset).expect(204);
  await request(isolatedApp)
    .post("/auth/recover")
    .send({ code: pending.body.data.code, password: `new-${randomUUID()}` })
    .expect(400);
  await person.get("/auth/me").expect(401);
  await person
    .post("/auth/login")
    .send({ email, password: replacement })
    .expect(200);
  const nextPassword = `last-${randomUUID()}`;
  await person
    .post("/auth/change-password")
    .send({ currentPassword: replacement, newPassword: nextPassword, answer })
    .expect(401);
  await person
    .post("/auth/change-password")
    .send({
      currentPassword: replacement,
      newPassword: nextPassword,
      answer: nextAnswer,
    })
    .expect(204);
  const events = await db.auditEvent.findMany({
    where: {
      entityId: id,
      action: {
        in: [
          "SECURITY_QUESTION_UPDATED",
          "SECURITY_QUESTION_ADMIN_RESET",
          "PASSWORD_CHANGED",
        ],
      },
    },
  });
  assert.equal(events.length, 4);
  const json = JSON.stringify(events);
  assert.ok(
    !json.includes(answer) &&
      !json.includes(nextAnswer) &&
      !json.includes(original) &&
      !json.includes(replacement),
  );
});
