import { z } from "zod";
import { uuid } from "../../shared/validation.js";

export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
    roleId: uuid,
    reason: z.string().trim().min(8).max(500),
  })
  .strict();
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    roleId: uuid,
    active: z.boolean(),
    updatedAt: z.iso.datetime(),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();
