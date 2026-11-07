import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middleware/authentication.js";
import { createReportsController } from "./reports.controller.js";

export function reportingRoutes(db: PrismaClient, demoMode: boolean) {
  const router = Router();
  const controller = createReportsController(db, demoMode);
  router.get(
    "/overview",
    requirePermission("overview:read"),
    controller.getOverview,
  );
  router.get(
    "/reports/:report",
    requirePermission("reports:read"),
    requirePermission("operations:read"),
    controller.getReportsReport,
  );
  return router;
}
