import { z } from "zod";

export const assetClassificationFilterSchema = z
  .enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"])
  .optional();
export const updateAssetPolicySchema = z
  .object({
    owner: z.string().trim().min(2).max(100),
    steward: z.string().trim().min(2).max(100),
    classification: z.enum([
      "PUBLIC",
      "INTERNAL",
      "CONFIDENTIAL",
      "RESTRICTED",
    ]),
    retentionDays: z.coerce.number().int().min(1).max(36500),
    policy: z.string().trim().min(8).max(1000),
    reason: z.string().trim().min(8).max(500),
    version: z.number().int().positive(),
  })
  .strict();
