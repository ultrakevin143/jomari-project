import { parse } from "dotenv";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd(),
  envPath = path.join(root, ".env");
await mkdir(path.join(root, ".local"), { recursive: true });
if (!existsSync(envPath)) {
  const dbPassword = randomBytes(24).toString("base64url"),
    password = randomBytes(18).toString("base64url");
  const env = (await readFile(path.join(root, ".env.example"), "utf8"))
    .replaceAll("local-development-only", dbPassword)
    .replace("SEED_PASSWORD=\n", `SEED_PASSWORD=${password}\n`);
  await writeFile(envPath, env, { flag: "wx" });
  console.info("Created local .env with generated passwords.");
} else console.info("Preserved existing .env.");
const env = parse(await readFile(envPath, "utf8"));
if (env.SEED_PASSWORD) {
  await writeFile(
    path.join(root, ".local", "development-access.md"),
    `# Local synthetic accounts\n\nOpen http://localhost:3000 after starting the app.\n\nPassword for these local accounts: ${env.SEED_PASSWORD}\n\n- admin@wastehub.demo — Administrator\n- operator@wastehub.demo — Integration operator\n- steward@wastehub.demo — Data steward\n- analyst@wastehub.demo — Read-only analyst\n\nThis file and .env are ignored by Git. Never use these identities in production.\n`,
  );
  console.info(
    "Local account details saved to .local/development-access.md (ignored by Git).",
  );
}
