import { z } from "zod";

export const auditActionFilterSchema = z.string().max(100).optional();
