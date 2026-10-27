import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middleware/authentication.js";
import { createInsightsController } from "./insights.controller.js";

export function insightsRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createInsightsController(db);
  router.get(
    "/quality-trends",
    requirePermission("dq:read"),
    controller.getQualityTrends,
  );
  router.get(
    "/collection-reliability",
    requirePermission("reports:read"),
    requirePermission("operations:read"),
    controller.getCollectionReliability,
  );
  return router;
}
