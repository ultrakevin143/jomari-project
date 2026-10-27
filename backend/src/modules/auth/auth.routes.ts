import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { type Config } from "../../config/env.js";
import { requirePermission } from "../../middleware/authentication.js";
import { ApiError } from "../../shared/errors.js";
import { createAuthController } from "./auth.controller.js";

export function authRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  const controller = createAuthController(db, config);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, _res, next) =>
      next(
        new ApiError(
          429,
          "RATE_LIMITED",
          "Too many sign-in attempts. Try again in 15 minutes.",
        ),
      ),
  });
  router.post("/login", limiter, controller.login);
  router.post(
    "/recover",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 8,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    controller.recoverPassword,
  );
  router.get("/me", controller.currentUser);
  const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  router.get("/security-question", controller.readQuestion);
  router.put(
    "/security-question",
    verificationLimiter,
    controller.writeQuestion,
  );
  router.post(
    "/change-password",
    verificationLimiter,
    controller.updatePassword,
  );
  router.post(
    "/refresh",
    requirePermission("operations:read"),
    controller.refresh,
  );
  router.post("/logout", controller.logout);
  return router;
}
