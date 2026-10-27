import { z } from "zod";

export const qualityTrendLimitSchema = z.coerce
  .number()
  .int()
  .min(2)
  .max(30)
  .default(12);
