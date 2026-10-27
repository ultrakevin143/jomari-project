import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default("127.0.0.1"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  ALLOW_REMOTE_DATABASE: z.enum(["true", "false"]).default("false"),
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
});
export type Config = z.infer<typeof envSchema>;
export const isLoopback = (host: string) =>
  ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = envSchema.parse(env);
  for (const value of [config.DATABASE_URL, config.DIRECT_URL].filter(
    Boolean,
  ) as string[]) {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      throw new Error("PostgreSQL URL required.");
    if (!isLoopback(url.hostname) && config.ALLOW_REMOTE_DATABASE !== "true") {
      throw new Error(
        "Remote database blocked. Explicitly set ALLOW_REMOTE_DATABASE=true only for an intentional deployment.",
      );
    }
    if (
      !isLoopback(url.hostname) &&
      url.searchParams.get("sslmode") !== "require"
    ) {
      throw new Error("Remote PostgreSQL requires sslmode=require.");
    }
  }
  if (
    config.NODE_ENV === "production" &&
    !config.WEB_ORIGIN.startsWith("https://")
  )
    throw new Error("Production WEB_ORIGIN must use HTTPS.");
  return config;
}
