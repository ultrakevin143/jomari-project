import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middleware/authentication.js";
import { createOperationsController } from "./operations.controller.js";

export function operationRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createOperationsController(db);
  router.use(requirePermission("operations:read"));
  router.get("/lookups", controller.getLookups);
  router.get(
    "/templates/:entity",
    requirePermission("integrations:write"),
    controller.getTemplatesEntity,
  );
  router.get("/:entity", controller.getEntity);
  router.get("/:entity/:id", controller.getEntityId);
  router.post(
    "/:entity/:id/archive",
    requirePermission("operations:write"),
    controller.postEntityIdArchive,
  );
  return router;
}
