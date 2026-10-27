import { type PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middleware/authentication.js";
import { createGovernanceController } from "./governance.controller.js";

export function governanceRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createGovernanceController(db);
  router.use(requirePermission("governance:read"));
  router.get("/domains", controller.getDomains);
  router.get("/assets", controller.getAssets);
  router.patch(
    "/assets/:id",
    requirePermission("governance:write"),
    controller.patchAssetsId,
  );
  return router;
}
