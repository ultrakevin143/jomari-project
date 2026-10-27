import { PrismaClient } from "@prisma/client";
import { config, parse } from "dotenv";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getConfig, isLoopback } from "../src/config/env.js";

config({ quiet: true });
const targetConfig = getConfig();
if (process.env.CONFIRM_INITIAL_COPY !== "waste-hub-initial-copy")
  throw new Error(
    "An intentional first-workspace copy requires CONFIRM_INITIAL_COPY=waste-hub-initial-copy.",
  );
const targetUrl = new URL(targetConfig.DIRECT_URL ?? targetConfig.DATABASE_URL),
  schema = targetUrl.searchParams.get("schema");
if (schema !== "waste_hub" || targetConfig.DEMO_MODE !== "true")
  throw new Error(
    "Initial synthetic workspace copy only supports the dedicated waste_hub demo schema.",
  );
const localConfig = parse(await readFile(".local/local.env", "utf8")),
  localUrl = new URL(localConfig.DATABASE_URL!);
if (!isLoopback(localUrl.hostname) || localUrl.pathname !== "/waste_hub")
  throw new Error("Source must be the local waste_hub workspace.");
const source = new PrismaClient({ datasourceUrl: localUrl.toString() }),
  target = new PrismaClient({ datasourceUrl: targetUrl.toString() });
// This fixed ordering follows foreign-key and organization-reference dependencies.
const tables = [
  "Organization",
  "Role",
  "Permission",
  "User",
  "DataDomain",
  "SourceSystem",
  "IntegrationConnection",
  "ServiceArea",
  "MaterialType",
  "Vehicle",
  "Facility",
  "CollectionRoute",
  "CollectionStop",
  "CollectionEvent",
  "VehicleTelemetryEvent",
  "WeighbridgeTransaction",
  "RecyclingRecoveryRecord",
  "ContaminationIncident",
  "WorkOrder",
  "CitizenRequest",
  "ServiceContract",
  "DataAsset",
  "IntegrationRun",
  "RawImportRecord",
  "IntegrationRecordError",
  "DQRule",
  "DQRun",
  "DQResult",
  "AuditEvent",
] as const;
try {
  const snapshot = await Promise.all(
    tables.map(async (table) => ({
      table,
      rows: await source.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM "public"."${table}"`,
      ),
    })),
  );
  await target.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74126001)`;
      for (const table of tables) {
        const count = await tx.$queryRawUnsafe<
          {
            count: bigint;
          }[]
        >(`SELECT count(*)::bigint AS count FROM "waste_hub"."${table}"`);
        if (Number(count[0]?.count) > 0)
          throw new Error(
            "Target application schema already contains data. Initial copy refused; existing data is preserved.",
          );
      }
      for (const { table, rows } of snapshot) {
        if (rows.length)
          await tx.$executeRawUnsafe(
            `INSERT INTO "waste_hub"."${table}" SELECT * FROM json_populate_recordset(NULL::"waste_hub"."${table}", $1::json)`,
            JSON.stringify(rows),
          );
      }
      const org = snapshot.find((t) => t.table === "Organization")?.rows[0];
      if (org)
        await tx.auditEvent.create({
          data: {
            organizationId: String(org.id),
            actorName: "Workspace provisioning",
            action: "WORKSPACE_INITIALIZED",
            entity: "organization",
            entityId: String(org.id),
            requestId: randomUUID(),
            reason:
              "User-authorized connection and initial synthetic workspace copy",
            metadata: {
              source: "verified local synthetic workspace",
              sessionsCopied: false,
              tableCount: tables.length,
            },
          },
        });
    },
    { timeout: 120000, maxWait: 15000 },
  );
  console.info(
    `Initial workspace copied in one transaction (${snapshot.reduce((n, t) => n + t.rows.length, 0)} rows). Session tokens were excluded.`,
  );
} finally {
  await Promise.all([source.$disconnect(), target.$disconnect()]);
}
