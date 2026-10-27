import { parse } from "dotenv";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isLoopback } from "../../backend/src/config/env.js";

const env = parse(await readFile(".local/local.env", "utf8"));
if (!isLoopback(new URL(env.DATABASE_URL!).hostname))
  throw new Error("Local preview requires a loopback database.");
if (!process.env.npm_execpath)
  throw new Error("Run this script through npm run dev:local.");
const demo = process.argv[2] === "demo";
const command = process.argv[2] === "start" ? "start" : "dev";
const webPort = demo ? "3100" : "3000",
  apiPort = demo ? "4100" : (env.PORT ?? "4000");
const children = ["backend", "frontend"].map((workspace) =>
  spawn(
    process.execPath,
    [process.env.npm_execpath!, "run", command, "-w", workspace],
    {
      env: {
        ...process.env,
        ...env,
        PORT: workspace === "frontend" ? webPort : apiPort,
        WEB_ORIGIN: `http://localhost:${webPort}`,
        API_ORIGIN: `http://127.0.0.1:${apiPort}`,
        ...(demo ? { WASTE_HUB_DIST_DIR: ".next-demo" } : {}),
        NODE_ENV:
          workspace === "frontend" && command === "start"
            ? "production"
            : "development",
        ALLOW_REMOTE_DATABASE: "false",
      },
      stdio: "inherit",
    },
  ),
);
for (const child of children)
  child.on("exit", (code) => {
    if (code) {
      process.exitCode = code;
      for (const other of children) if (other !== child) other.kill();
    }
  });
