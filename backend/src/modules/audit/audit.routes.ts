import { type PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middleware/authentication.js";
import { createAuditController } from "./audit.controller.js";

export function auditRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createAuditController(db);
  router.use(requirePermission("audit:read"));
  router.get("/", controller.getIndex);
  return router;
}
