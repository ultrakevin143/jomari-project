import { Prisma } from "@prisma/client";
import { type ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { z } from "zod";
import { ApiError } from "../shared/errors.js";
export function errorHandler(log: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    let status = 500,
      code = "INTERNAL_ERROR",
      message = "The request could not be completed.",
      details: unknown;
    if (error instanceof ApiError) {
      ({ status, code, message, details } = error);
    } else if (error instanceof z.ZodError) {
      status = 422;
      code = "VALIDATION_FAILED";
      message = "Check the highlighted request fields.";
      details = error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
    } else if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P1001", "P1002", "P2024"].includes(error.code))
    ) {
      status = 503;
      code = "DATABASE_UNAVAILABLE";
      message = "The database is temporarily unavailable. Try again later.";
    } else if (error instanceof SyntaxError) {
      status = 400;
      code = "INVALID_JSON";
      message = "Request body must contain valid JSON.";
    } else if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      status = 413;
      code = "REQUEST_TOO_LARGE";
      message = "Request body exceeds the 2 MB limit.";
    }
    if (status >= 500)
      log.error(
        {
          requestId: req.requestId,
          code,
          errorType: error instanceof Error ? error.name : "unknown",
        },
        "request failed",
      );
    res.status(status).json({
      error: {
        code,
        message,
        requestId: req.requestId,
        ...(details ? { details } : {}),
      },
    });
  };
}
