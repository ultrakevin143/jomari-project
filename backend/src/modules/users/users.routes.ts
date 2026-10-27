import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAdministrator } from "../../middleware/administrator.js";
import { createUsersController } from "./users.controller.js";

export function userRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createUsersController(db);
  router.use(requireAdministrator);
  router.get("/roles", controller.listRoles);
  router.get("/", controller.listUsers);
  router.post("/", controller.createUser);
  router.patch("/:id", controller.updateUser);
  router.put(
    "/:id/security-question",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    controller.resetQuestion,
  );
  router.post(
    "/:id/recovery",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    controller.recoverPassword,
  );
  return router;
}
