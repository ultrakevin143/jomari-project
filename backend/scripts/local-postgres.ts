import { config } from "dotenv";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { getConfig, isLoopback } from "../src/config/env.js";
import { embeddedPostgres } from "./postgres-runtime.js";

config({
  path: process.env.WASTE_HUB_ENV_FILE ?? ".env",
  override: Boolean(process.env.WASTE_HUB_ENV_FILE),
  quiet: true,
});
const settings = getConfig(),
  url = new URL(settings.DATABASE_URL);
if (!isLoopback(url.hostname))
  throw new Error("db:local only starts a local database.");
const databaseDir = path.join(process.cwd(), ".local", "postgres");
await mkdir(databaseDir, { recursive: true });
const pg = embeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port || 5432),
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message) =>
    console.error(
      typeof message === "string" ? message : "PostgreSQL startup error",
    ),
});
if (!existsSync(path.join(databaseDir, "PG_VERSION"))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const name = url.pathname.slice(1);
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
  throw new Error("Invalid local database name.");
const found = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = $1",
  [name],
);
if (!found.rowCount) await pg.createDatabase(name);
await client.end();
console.info(
  `Local PostgreSQL ready on 127.0.0.1:${url.port}. Database: ${name}. Stop with Ctrl+C.`,
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
