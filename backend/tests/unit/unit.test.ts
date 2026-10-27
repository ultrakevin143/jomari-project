import assert from "node:assert/strict";
import { test } from "node:test";
import { getConfig, isLoopback } from "../../src/config/env.js";
import { openapi } from "../../src/docs/openapi.js";
import { allowedTransition } from "../../src/modules/canonical/canonical.policy.js";
import { validateRecord } from "../../src/modules/canonical/canonical.schemas.js";
import {
  evaluateRule,
  qualityScore,
} from "../../src/modules/quality/quality.engine.js";
import { type snapshot } from "../../src/modules/quality/quality.repository.js";
import { ruleDefinitions } from "../../src/modules/quality/quality.rules.js";
import { csv } from "../../src/shared/csv.js";
import { stableHash } from "../../src/shared/hash.js";
import { hashPassword, verifyPassword } from "../../src/shared/security.js";

test("remote and Neon URLs are blocked by default, before a connection is created", () => {
  assert.throws(
    () =>
      getConfig({
        DATABASE_URL:
          "postgresql://user:secret@example-pooler.neon.tech/database?sslmode=require",
      }),
    /Remote database blocked/,
  );
  assert.throws(
    () =>
      getConfig({
        DATABASE_URL: "postgresql://user:secret@example.neon.tech/database",
        ALLOW_REMOTE_DATABASE: "true",
      }),
    /sslmode/,
  );
  assert.equal(isLoopback("127.0.0.1"), true);
  assert.equal(isLoopback("127.0.0.1.evil.example"), false);
});
test("password hashing verifies secrets without storing plaintext", async () => {
  const hash = await hashPassword("local-unit-password");
  assert.notEqual(hash, "local-unit-password");
  assert.equal(await verifyPassword("local-unit-password", hash), true);
  assert.equal(await verifyPassword("incorrect", hash), false);
});
test("timestamps need a timezone and weights must reconcile", () => {
  const row = {
    sourceRecordId: "wb-unit",
    sourceUpdatedAt: "2026-10-26T08:00:00Z",
    ticketNumber: "WB-U",
    facilityId: "7b617d67-dfa1-4e29-9dd2-2fe806034f98",
    materialTypeId: "7b617d67-dfa1-4e29-9dd2-2fe806034f97",
    grossKg: 12000,
    tareKg: 6000,
    netKg: 6000,
    occurredAt: "2026-10-26T16:00:00+08:00",
  };
  assert.equal(validateRecord("weighbridge", row).success, true);
  assert.equal(
    validateRecord("weighbridge", { ...row, netKg: -1 }).success,
    false,
  );
  assert.equal(
    validateRecord("weighbridge", { ...row, netKg: 5000 }).success,
    false,
  );
  assert.equal(
    validateRecord("weighbridge", { ...row, occurredAt: "2026-10-26T08:00:00" })
      .success,
    false,
  );
});
test("request lifecycle rejects invalid jumps and post-closure reopen", () => {
  assert.equal(allowedTransition("OPEN", "ASSIGNED"), true);
  assert.equal(allowedTransition("OPEN", "CLOSED"), false);
  assert.equal(allowedTransition("CLOSED", "OPEN"), false);
  assert.equal(allowedTransition("RESOLVED", "ASSIGNED"), true);
});
test("source version hashing is independent of JSON property order", () => {
  assert.equal(
    stableHash({ b: 2, a: { z: 3, y: 1 } }),
    stableHash({ a: { y: 1, z: 3 }, b: 2 }),
  );
});
test("CSV escapes formulas, quotes, commas and line breaks", () => {
  const result = csv([
    {
      name: '=HYPERLINK("x")',
      note: "two, words\nnext line",
      negative: " -formula",
    },
  ]);
  assert.match(result, /'=HYPERLINK/);
  assert.match(result, /two, words\nnext line/);
  assert.match(result, /' -formula/);
});
const empty: Awaited<ReturnType<typeof snapshot>> = {
  routes: [],
  vehicles: [],
  facilities: [],
  weights: [],
  recycling: [],
  events: [],
  requests: [],
  raw: [],
  sources: [],
  assets: [],
  materials: [],
  telemetry: [],
  workOrders: [],
  contracts: [],
};
test("all fourteen registered quality checks execute and unknown checks fail closed", () => {
  assert.equal(ruleDefinitions.length, 14);
  for (const rule of ruleDefinitions)
    assert.deepEqual(evaluateRule(rule[6], empty), {
      checked: 0,
      failed: 0,
      samples: [],
    });
  assert.throws(() => evaluateRule("arbitrary_code", empty), /Unsupported/);
});
test("duplicate detection allows historical replay but flags duplicate IDs within one run", () => {
  const raw = [
    { id: "1", runId: "a", sourceRecordId: "x" },
    { id: "2", runId: "b", sourceRecordId: "x" },
  ];
  assert.equal(evaluateRule("duplicates", { ...empty, raw }).failed, 0);
  assert.equal(
    evaluateRule("duplicates", {
      ...empty,
      raw: [...raw, { id: "3", runId: "a", sourceRecordId: "x" }],
    }).failed,
    2,
  );
});
test("quality scoring uses record-rule pairs and exposes a no-check baseline", () => {
  assert.equal(qualityScore(200, 3), 98.5);
  assert.equal(qualityScore(0, 0), 100);
});
test("OpenAPI documents every core operation and a cookie security scheme", () => {
  const spec = openapi();
  assert.equal(spec.openapi, "3.1.0");
  for (const path of [
    "/auth/login",
    "/integrations/imports",
    "/dq/runs",
    "/governance/assets/{id}",
    "/audit-events",
    "/reports/operations",
  ])
    assert.ok(spec.paths[path]);
  assert.equal(spec.components.securitySchemes.session.in, "cookie");
});
test("required numeric fields reject null, booleans, blanks and arrays instead of silently becoming zero", () => {
  const vehicle = {
    sourceRecordId: "numeric-check",
    sourceUpdatedAt: "2026-10-26T08:00:00Z",
    registration: "DEMO-NUM",
    code: "V-NUM",
    type: "Rear loader",
    capacityKg: 9000,
    mileageKm: 100,
    fuelLitres: 20,
    status: "AVAILABLE",
  };
  for (const value of [null, false, true, "", "   ", [], {}])
    assert.equal(
      validateRecord("vehicles", { ...vehicle, capacityKg: value }).success,
      false,
      `Invalid numeric value: ${JSON.stringify(value)}`,
    );
  assert.equal(
    validateRecord("vehicles", { ...vehicle, capacityKg: "9000" }).success,
    true,
  );
  assert.equal(
    validateRecord("vehicles", { ...vehicle, capacityKg: 0 }).success,
    true,
  );
});
