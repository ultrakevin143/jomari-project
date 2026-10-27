import type { RequestHandler } from "express";
import { type Config } from "../config/env.js";
import { ApiError } from "../shared/errors.js";
export function originProtection(config: Config): RequestHandler {
  return (req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.header("origin");
      if (origin && origin !== config.WEB_ORIGIN)
        return next(
          new ApiError(
            403,
            "ORIGIN_DENIED",
            "This request must originate from the application.",
          ),
        );
      if (req.header("sec-fetch-site") === "cross-site")
        return next(
          new ApiError(403, "CSRF_BLOCKED", "Cross-site changes are blocked."),
        );
      if (req.headers["content-type"] && !req.is("application/json"))
        return next(new ApiError(415, "CONTENT_TYPE", "Use application/json."));
    }
    next();
  };
}
