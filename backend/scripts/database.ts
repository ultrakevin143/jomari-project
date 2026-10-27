import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { seed } from "../prisma/seed.js";
import { getConfig, isLoopback } from "../src/config/env.js";

config({
  path: process.env.WASTE_HUB_ENV_FILE ?? ".env",
  override: Boolean(process.env.WASTE_HUB_ENV_FILE),
  quiet: true,
});
const settings = getConfig();
const command = process.argv[2],
  url = new URL(settings.DIRECT_URL ?? settings.DATABASE_URL);
if (!isLoopback(url.hostname)) {
  if (command === "seed")
    throw new Error("Demo seed is blocked for every remote database.");
  if (
    command === "migrate" &&
    process.env.CONFIRM_REMOTE_WRITE !== "waste-hub-migrations"
  )
    throw new Error(
      "Intentional remote migration requires CONFIRM_REMOTE_WRITE=waste-hub-migrations.",
    );
}
if (command === "seed") {
  if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 12)
    throw new Error("Set SEED_PASSWORD to at least 12 characters.");
  if (settings.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  const db = new PrismaClient();
  try {
    await seed(db, process.env.SEED_PASSWORD);
    console.info("Synthetic seed completed.");
  } finally {
    await db.$disconnect();
  }
} else if (command === "migrate" || command === "status") {
  const require = createRequire(import.meta.url),
    cli = require.resolve("prisma/build/index.js");
  const child = spawn(
    process.execPath,
    [cli, "migrate", command === "migrate" ? "deploy" : "status"],
    { stdio: "inherit", env: process.env },
  );
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
} else throw new Error("Use db:migrate, db:status or db:seed.");
