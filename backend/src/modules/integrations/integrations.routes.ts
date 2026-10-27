import { type PrismaClient } from "@prisma/client";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requirePermission } from "../../middleware/authentication.js";
import { ApiError } from "../../shared/errors.js";
import { createIntegrationsController } from "./integrations.controller.js";

export function integrationRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createIntegrationsController(db);
  router.use(requirePermission("integrations:read"));
  const limit = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new ApiError(
          429,
          "RATE_LIMITED",
          "Wait a minute before starting another import.",
        ),
      ),
  });
  router.get("/sources", controller.getSources);
  router.get("/runs", controller.getRuns);
  router.get("/runs/:id", controller.getRunsId);
  router.get("/errors", controller.getErrors);
  router.post(
    "/imports",
    requirePermission("integrations:write"),
    limit,
    controller.postImports,
  );
  router.post(
    "/runs/:id/retry",
    requirePermission("integrations:write"),
    limit,
    controller.postRunsIdRetry,
  );
  return router;
}
