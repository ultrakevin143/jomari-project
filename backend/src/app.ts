import { type PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import { type Config } from "./config/env.js";
import { openapi } from "./docs/openapi.js";
import { authentication } from "./middleware/authentication.js";
import { errorHandler } from "./middleware/error-handler.js";
import { originProtection } from "./middleware/origin-protection.js";
import { requestLogging } from "./middleware/request-logging.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { governanceRoutes } from "./modules/governance/governance.routes.js";
import { insightsRoutes } from "./modules/insights/insights.routes.js";
import { integrationRoutes } from "./modules/integrations/integrations.routes.js";
import { operationRoutes } from "./modules/operations/operations.routes.js";
import { qualityRoutes } from "./modules/quality/quality.routes.js";
import { reportingRoutes } from "./modules/reports/reports.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { ApiError } from "./shared/errors.js";
export function createApp(db: PrismaClient, config: Config) {
  const app = express(),
    log = pino({ level: config.NODE_ENV === "test" ? "silent" : "info" });
  app.disable("x-powered-by");
  app.use(requestLogging(log));
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === config.WEB_ORIGIN) callback(null, true);
        else
          callback(
            new ApiError(403, "ORIGIN_DENIED", "Origin is not allowed."),
          );
      },
      credentials: true,
    }),
  );
  app.use(originProtection(config));
  app.use(express.json({ limit: "2mb", strict: true }));
  app.use(cookieParser());
  app.get("/health", (_req, res) =>
    res.json({ status: "ok", service: "waste-hub-api" }),
  );
  let readyUntil = 0;
  app.get("/ready", async (_req, res) => {
    if (Date.now() > readyUntil) {
      await db.$queryRaw`SELECT 1`;
      readyUntil = Date.now() + 30000;
    }
    res.json({ status: "ready" });
  });
  app.get("/openapi.json", (_req, res) => res.json(openapi()));
  app.get("/docs", (_req, res) =>
    res
      .type("html")
      .send(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Waste Hub API</title><body><main><h1>Waste Operations Data Hub API</h1><p>REST API version 1.0.0. Sign in using an HTTP-only session cookie.</p><p><a href="./openapi.json">Download the complete OpenAPI 3.1 specification</a></p><p>Import the specification into your API client. The repository README documents permissions, CSV formats, idempotency, error codes and local setup.</p><p>Health: GET /health. Database readiness: GET /ready (30-second cache).</p></main></body></html>',
      ),
  );
  app.use(authentication(db));
  app.use("/auth", authRoutes(db, config));
  app.use("/users", userRoutes(db));
  app.use("/insights", insightsRoutes(db));
  app.use("/operations", operationRoutes(db));
  app.use("/integrations", integrationRoutes(db));
  app.use("/dq", qualityRoutes(db));
  app.use("/governance", governanceRoutes(db));
  app.use("/audit-events", auditRoutes(db));
  app.use(reportingRoutes(db, config.DEMO_MODE === "true"));
  app.use((_req, _res, next) =>
    next(new ApiError(404, "NOT_FOUND", "Endpoint not found.")),
  );
  app.use(errorHandler(log));
  return app;
}
