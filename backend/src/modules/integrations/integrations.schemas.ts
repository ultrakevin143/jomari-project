import { z } from "zod";
import { uuid } from "../../shared/validation.js";
import { entitySchema } from "../canonical/canonical.schemas.js";

export const record = z.record(z.string(), z.json());
export const importSchema = z
  .object({
    sourceSystemId: uuid,
    entity: entitySchema.optional(),
    idempotencyKey: z.string().trim().min(8).max(120),
    format: z.enum(["csv", "json", "mock"]),
    csv: z.string().max(1000000).optional(),
    records: z.array(record).max(500).optional(),
  })
  .strict();
export const integrationRunStatusFilterSchema = z
  .enum(["RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"])
  .optional();
export const integrationErrorStatusSchema = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
]);
export const retryCorrectionsSchema = z
  .object({
    corrections: z
      .array(z.object({ errorId: uuid, payload: record }).strict())
      .max(500)
      .default([]),
  })
  .strict();
