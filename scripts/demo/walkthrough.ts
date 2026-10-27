import { parse } from "dotenv";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isLoopback } from "../../backend/src/config/env.js";

// This walkthrough has a fixed local API destination and reads only local demo credentials.
// It never loads .env, constructs a remote Prisma client, or calls the Neon API.
const origin = "http://127.0.0.1:4100",
  web = "http://localhost:3100";
assert.ok(isLoopback(new URL(origin).hostname));
const env = parse(await readFile(".local/local.env", "utf8"));
assert.ok(
  isLoopback(new URL(env.DATABASE_URL!).hostname),
  "Demo database must be local.",
);
type Row = Record<string, unknown>;
type RuleResult = {
  id: string;
  checked: number;
  failed: number;
  remediation: string;
  rule: {
    code: string;
    name: string;
    severity: string;
  };
  samples: {
    id: string;
    reason: string;
  }[];
};
type Score = {
  id: string;
  score: number;
  checked: number;
  failed: number;
  results: RuleResult[];
};
type Run = {
  id: string;
  status: string;
  processed: number;
  failed: number;
  skipped: number;
  replayed?: boolean;
  errors?: {
    id: string;
    rawRecord: {
      payload: Row;
    };
  }[];
};
const steps: {
    step: string;
    result: string;
    details: unknown;
  }[] = [],
  timings: {
    path: string;
    status: number;
    ms: number;
  }[] = [];
const tag = randomUUID().slice(0, 8);
function check(step: string, result: string, details: unknown = {}) {
  steps.push({ step, result, details });
  console.info(`PASS ${steps.length}. ${step} — ${result}`);
}
class Client {
  cookie = "";
  signedIn = false;
  async call<T>(
    path: string,
    method = "GET",
    body?: unknown,
    expected = 200,
  ): Promise<T> {
    const started = performance.now();
    const response = await fetch(origin + path, {
      method,
      headers: {
        Origin: web,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    timings.push({
      path,
      status: response.status,
      ms: Math.round(performance.now() - started),
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) this.cookie = cookies[0]!.split(";")[0]!;
    const result =
      response.status === 204
        ? undefined
        : response.headers.get("content-type")?.includes("json")
          ? await response.json()
          : await response.text();
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${JSON.stringify(result)}`,
    );
    return result as T;
  }
}
const admin = new Client(),
  operator = new Client(),
  steward = new Client(),
  analyst = new Client();
try {
  for (const [client, role] of [
    [admin, "admin"],
    [operator, "operator"],
    [steward, "steward"],
    [analyst, "analyst"],
  ] as const) {
    const result = await client.call<{
      data: {
        role: string;
        permissions: string[];
      };
    }>("/auth/login", "POST", {
      email: `${role}@wastehub.demo`,
      password: env.SEED_PASSWORD,
    });
    client.signedIn = true;
    assert.ok(result.data.permissions.length);
    check(`${role} sign-in`, result.data.role);
  }
  const systems = await admin.call<{
    data: {
      id: string;
      code: string;
    }[];
  }>("/integrations/sources");
  assert.equal(systems.data.length, 7);
  const source = (code: string) =>
    systems.data.find((s) => s.code === code)!.id;
  const template = await operator.call<{
    data: Row[];
  }>("/operations/templates/weighbridge");
  const good = {
    ...template.data[0]!,
    sourceRecordId: `demo-${tag}-valid`,
    ticketNumber: `DEMO-${tag}-A`,
  };
  const bad = {
    ...good,
    sourceRecordId: `demo-${tag}-invalid`,
    ticketNumber: `DEMO-${tag}-B`,
    netKg: -500,
  };
  const keys = Object.keys(good),
    cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [
    keys.join(","),
    ...([good, bad] as Row[]).map((row) =>
      keys.map((key) => cell(row[key])).join(","),
    ),
  ].join("\n");
  const importBody = {
    sourceSystemId: source("weighbridge"),
    idempotencyKey: `local-demo-${tag}`,
    format: "csv",
    csv,
  };
  const imported = await operator.call<{
    data: Run;
  }>("/integrations/imports", "POST", importBody, 201);
  assert.equal(imported.data.processed, 1);
  assert.equal(imported.data.failed, 1);
  check(
    "CSV import with invalid weight",
    "1 loaded, 1 quarantined",
    imported.data,
  );
  const replay = await operator.call<{
    data: Run;
  }>("/integrations/imports", "POST", importBody, 201);
  assert.equal(replay.data.id, imported.data.id);
  assert.equal(replay.data.replayed, true);
  check("Idempotent replay", "same run returned; no extra rows");
  const beforeRetry = await operator.call<{
      data: Run;
    }>(`/integrations/runs/${imported.data.id}`),
    error = beforeRetry.data.errors![0]!;
  const corrected = {
    ...error.rawRecord.payload,
    netKg:
      Number(error.rawRecord.payload.grossKg) -
      Number(error.rawRecord.payload.tareKg),
  };
  const retried = await operator.call<{
    data: Run;
  }>(`/integrations/runs/${imported.data.id}/retry`, "POST", {
    corrections: [{ errorId: error.id, payload: corrected }],
  });
  assert.equal(retried.data.status, "SUCCEEDED");
  assert.equal(retried.data.processed, 2);
  assert.equal(retried.data.failed, 0);
  check(
    "Failed-record correction",
    "2 loaded, 0 quarantined; successful row preserved",
    retried.data,
  );
  const routeTemplate = await operator.call<{
    data: Row[];
  }>("/operations/templates/routes");
  const route: Row = {
    ...routeTemplate.data[0]!,
    sourceRecordId: `demo-${tag}-route`,
    code: `DEMO-${tag}`,
    name: "Local DQM demonstration route",
    durationMinutes: 900,
  };
  await operator.call(
    "/integrations/imports",
    "POST",
    {
      sourceSystemId: source("collection"),
      entity: "routes",
      format: "json",
      idempotencyKey: `local-demo-route-${tag}`,
      records: [route],
    },
    201,
  );
  await steward.call("/dq/runs", "POST", {}, 201);
  const baseline = (
    await steward.call<{
      data: Score;
    }>("/dq/scorecards")
  ).data;
  assert.equal(baseline.results.length, 14);
  const outlier = baseline.results.find((r) => r.rule.code === "OUTLIERS")!;
  assert.ok(outlier.failed > 0);
  const checked = baseline.results.reduce((n, r) => n + r.checked, 0),
    failed = baseline.results.reduce((n, r) => n + r.failed, 0);
  assert.equal(
    baseline.score,
    Math.round(((checked - failed) / checked) * 10000) / 100,
  );
  check(
    "Persisted DQM and independent score",
    "all 14 results saved; 900-minute route detected",
    { score: baseline.score, checked, failed, outlierFailures: outlier.failed },
  );
  await steward.call(`/dq/results/${outlier.id}`, "PATCH", {
    remediation: "ACKNOWLEDGED",
    note: `Local demo ${tag}: investigate source route duration before correction.`,
  });
  const acknowledged = (
    await steward.call<{
      data: Score;
    }>("/dq/scorecards")
  ).data;
  assert.equal(acknowledged.score, baseline.score);
  check(
    "Remediation accountability",
    "acknowledgement leaves observed score unchanged",
  );
  await operator.call(
    "/integrations/imports",
    "POST",
    {
      sourceSystemId: source("collection"),
      entity: "routes",
      format: "json",
      idempotencyKey: `local-demo-fixed-${tag}`,
      records: [
        {
          ...route,
          durationMinutes: 240,
          sourceUpdatedAt: new Date(
            new Date(String(route.sourceUpdatedAt)).getTime() + 1000,
          ).toISOString(),
        },
      ],
    },
    201,
  );
  await steward.call("/dq/runs", "POST", {}, 201);
  const after = (
    await steward.call<{
      data: Score;
    }>("/dq/scorecards")
  ).data;
  assert.equal(after.checked, baseline.checked + 1); // One additional immutable import row is evaluated for duplicates.
  assert.equal(after.failed, baseline.failed - 1);
  assert.ok(after.score > baseline.score);
  check(
    "Correction and DQM remeasurement",
    "one fewer failed check; score improves",
    {
      before: baseline.score,
      after: after.score,
      failedBefore: baseline.failed,
      failedAfter: after.failed,
    },
  );
  const assets = await steward.call<{
    data: Row[];
  }>("/governance/assets?pageSize=100");
  const asset = assets.data.find((a) => a.entity === "weighbridge")!;
  const policy = {
    owner: asset.owner,
    steward: asset.steward,
    classification: asset.classification,
    retentionDays: asset.retentionDays,
    policy: asset.policy,
    reason: `Local demo ${tag}: reviewed ownership, retention and classification.`,
    version: asset.version,
  };
  await steward.call(`/governance/assets/${asset.id}`, "PATCH", policy);
  await steward.call(`/governance/assets/${asset.id}`, "PATCH", policy, 409);
  check(
    "Governance change control",
    "audited policy save; stale version rejected",
  );
  await analyst.call("/integrations/imports", "POST", {}, 403);
  await analyst.call("/dq/runs", "POST", {}, 403);
  await analyst.call("/audit-events", "GET", undefined, 403);
  check(
    "Analyst least privilege",
    "ingestion, DQM execution and audit access denied server-side",
  );
  const service = await analyst.call<{
    data: Row[];
  }>("/operations/citizen-requests");
  assert.ok(service.data.every((r) => !("citizenAlias" in r)));
  check(
    "Citizen data masking",
    "identity aliases omitted from operational output",
  );
  const csvReport = await analyst.call<string>(
    "/reports/operations?format=csv",
  );
  assert.ok(csvReport.includes("scheduledStops"));
  await mkdir(".local/demo-evidence", { recursive: true });
  await writeFile(".local/demo-evidence/operations.csv", csvReport);
  check("Governed CSV export", "non-empty report downloaded and audited");
  const events = await admin.call<{
    data: {
      action: string;
      metadata: Row;
      reason: string | null;
    }[];
  }>("/audit-events?pageSize=100");
  const expected = [
    "IMPORT_STARTED",
    "IMPORT_COMPLETED",
    "IMPORT_RECORD_RETRIED",
    "IMPORT_RETRIED",
    "DQ_STARTED",
    "DQ_EXECUTED",
    "DQ_REMEDIATION_CHANGED",
    "GOVERNANCE_ASSET_CHANGED",
    "REPORT_EXPORTED",
  ];
  for (const action of expected)
    assert.ok(
      events.data.some((e) => e.action === action),
      `Missing audit event: ${action}`,
    );
  check(
    "End-to-end audit trail",
    "all nine required workflow actions present",
    expected,
  );
  const overview = await analyst.call<{
    data: {
      totals: Row;
      quality: {
        score: number;
      };
      sources: unknown[];
    };
  }>("/overview");
  assert.equal(overview.data.sources.length, 7);
  assert.equal(overview.data.quality.score, after.score);
  check(
    "Dashboard consistency",
    "overview uses latest persisted DQM score and seven sources",
    overview.data.totals,
  );
  const shell = await fetch(web, { signal: AbortSignal.timeout(60000) });
  assert.equal(shell.status, 200);
  assert.equal(shell.headers.get("x-content-type-options"), "nosniff");
  assert.equal(shell.headers.get("x-frame-options"), "DENY");
  check(
    "Frontend HTTP delivery",
    "Next.js returns 200 with security headers (browser interaction unverified)",
  );
  for (const client of [admin, operator, steward, analyst]) {
    await client.call("/auth/logout", "POST", {}, 204);
    await client.call("/auth/me", "GET", undefined, 401);
    client.signedIn = false;
  }
  check("Session logout", "all four session cookies invalidated");
  const report = {
    status: "PASS",
    date: new Date().toISOString(),
    demoId: tag,
    environment: "local PostgreSQL only",
    api: origin,
    web,
    neonRequests: 0,
    steps,
    timings,
    qualityBefore: baseline,
    qualityAfter: after,
    browserAutomation:
      "Disabled by Work settings; no browser interaction claimed.",
  };
  await writeFile(
    ".local/demo-evidence/results.json",
    JSON.stringify(report, null, 2),
  );
  console.info(
    `Completed ${steps.length} demo checkpoints. Evidence: .local/demo-evidence/results.json`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Demo failed.");
  process.exitCode = 1;
} finally {
  for (const client of [admin, operator, steward, analyst]) {
    if (!client.signedIn) continue;
    try {
      await client.call("/auth/logout", "POST", {}, 204);
      client.signedIn = false;
    } catch {
      console.error("Could not revoke a local walkthrough session.");
      process.exitCode = 1;
    }
  }
}
