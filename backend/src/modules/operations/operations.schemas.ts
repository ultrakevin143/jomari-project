import { z } from "zod";

export const archivableEntitySchema = z.enum([
  "routes",
  "vehicles",
  "facilities",
]);
export const archiveReasonSchema = z
  .object({ reason: z.string().trim().min(8).max(500) })
  .strict();
