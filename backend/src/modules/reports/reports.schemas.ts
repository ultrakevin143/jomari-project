import { z } from "zod";

export const reportNameSchema = z.enum(["operations", "diversion"]);
