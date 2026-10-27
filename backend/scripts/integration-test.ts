import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { isLoopback } from "../src/config/env.js";
import { embeddedPostgres } from "./postgres-runtime.js";

// Deliberately never load .env or fall back to DATABASE_URL.
const require = createRequire(import.meta.url),
  root = process.cwd();
let pg: EmbeddedPostgres | undefined;
let testDirectory: string | undefined;
let testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (
    !isLoopback(url.hostname) ||
    !/^\/waste_hub_test(?:_[a-z0-9]+)?$/.test(url.pathname)
  )
    throw new Error(
      "Tests require a loopback database named waste_hub_test (or waste_hub_test_<suffix>). Neon and other remote hosts are always blocked.",
    );
} else {
  const local = path.resolve(root, ".local");
  await mkdir(local, { recursive: true });
  const databaseDir = await mkdtemp(path.join(local, "pg-test-"));
  testDirectory = databaseDir;
  if (!path.resolve(databaseDir).startsWith(local + path.sep))
    throw new Error("Test database directory escaped the workspace.");
  const password = randomBytes(24).toString("base64url");
  pg = embeddedPostgres({
    databaseDir,
    user: "test_runner",
    password,
    port: 54330,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: (message) => {
      if (/FATAL|PANIC|could not/i.test(message)) console.error(message);
    },
    onError: (error) =>
      console.error(
        typeof error === "string" ? error : "Local PostgreSQL startup failed.",
      ),
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("waste_hub_test");
  testUrl = `postgresql://test_runner:${password}@127.0.0.1:54330/waste_hub_test?connection_limit=4`;
}
const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: testUrl,
  DIRECT_URL: testUrl,
  ALLOW_REMOTE_DATABASE: "false",
  WEB_ORIGIN: "http://localhost:3000",
  DEMO_MODE: "true",
  SEED_PASSWORD: randomBytes(18).toString("base64url"),
};
function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Local verification exited ${code}`)),
    );
  });
}
try {
  console.info("Integration verification uses local PostgreSQL only.");
  await run([
    require.resolve("prisma/build/index.js"),
    "migrate",
    "deploy",
    "--schema",
    "backend/prisma/schema.prisma",
  ]);
  await run([
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    "backend/tests/integration/integration.test.ts",
  ]);
} finally {
  await pg?.stop();
  if (testDirectory) {
    const allowedRoot = path.resolve(root, ".local") + path.sep;
    if (path.resolve(testDirectory).startsWith(allowedRoot)) {
      await rm(testDirectory, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 250,
      });
    } else {
      console.error("Refused cleanup outside the local test directory.");
      process.exitCode = 1;
    }
  }
}
