import { z } from "zod";

export const qualitySeverityFilterSchema = z
  .enum(["INFO", "WARNING", "ERROR"])
  .optional();
export const startQualityRunSchema = z.object({}).strict();
export const updateRemediationSchema = z
  .object({
    remediation: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]),
    note: z.string().trim().min(8).max(1000),
  })
  .strict();
