import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { getConfig } from "../src/config/env.js";

config({ quiet: true });
const settings = getConfig();
const db = new PrismaClient({
  datasourceUrl: settings.DIRECT_URL ?? settings.DATABASE_URL,
});
try {
  const schemas = await db.$queryRaw<
    {
      schema: string;
      tables: bigint;
    }[]
  >`SELECT table_schema AS schema, count(*)::bigint AS tables FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') GROUP BY table_schema ORDER BY table_schema`;
  console.info(
    JSON.stringify({
      applicationSchema:
        new URL(settings.DATABASE_URL).searchParams.get("schema") ?? "public",
      existingSchemas: schemas.map((s) => ({
        schema: s.schema,
        tables: Number(s.tables),
      })),
    }),
  );
} finally {
  await db.$disconnect();
}
