import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import { invalidateReports } from "../modules/reports/reports.service.js";
export function requestLogging(log: Logger): RequestHandler {
  return (req, res, next) => {
    const supplied = req.header("x-request-id");
    req.requestId =
      supplied && /^[a-zA-Z0-9_-]{8,100}$/.test(supplied)
        ? supplied
        : randomUUID();
    res.setHeader("x-request-id", req.requestId);
    res.setHeader("Cache-Control", "no-store");
    const start = Date.now();
    res.on("finish", () => {
      log.info(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - start,
        },
        "request",
      );
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        res.statusCode < 400
      )
        invalidateReports();
    });
    next();
  };
}
