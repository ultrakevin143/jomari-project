import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middleware/authentication.js";
import { createQualityController } from "./quality.controller.js";

export function qualityRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createQualityController(db);
  router.use(requirePermission("dq:read"));
  router.get("/rules", controller.getRules);
  router.get("/runs", controller.getRuns);
  router.get("/scorecards", controller.getScorecards);
  router.post("/runs", requirePermission("dq:write"), controller.postRuns);
  router.patch(
    "/results/:id",
    requirePermission("dq:write"),
    controller.patchResultsId,
  );
  return router;
}
