import type { RequestHandler } from "express";
import { ApiError } from "../shared/errors.js";
import { identity } from "../shared/request-context.js";
export const requireAdministrator: RequestHandler = (req, _res, next) => {
  const user = identity(req);
  if (user.roleCode !== "admin")
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Only municipal workspace administrators can manage users.",
    );
  next();
};
