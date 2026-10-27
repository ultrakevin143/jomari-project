import { findSession } from "../modules/auth/auth.repository.js";

import type { PrismaClient } from "@prisma/client";
import { type RequestHandler } from "express";
import { ApiError } from "../shared/errors.js";
import { identity } from "../shared/request-context.js";
import { tokenHash } from "../shared/security.js";

export function authentication(db: PrismaClient): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token: unknown = req.cookies?.waste_session;
      if (typeof token !== "string" || token.length > 100) return next();
      const session = await findSession(db, tokenHash(token));
      if (
        session &&
        session.expiresAt > new Date() &&
        session.user.active &&
        session.user.organizationId === session.user.role.organizationId
      ) {
        const { user } = session;
        req.identity = {
          id: user.id,
          organizationId: user.organizationId,
          name: user.name,
          email: user.email,
          role: user.role.name,
          roleCode: user.role.code,
          permissions: user.role.permissions.map((p) => p.code),
          sessionId: session.id,
        };
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
export function requirePermission(permission: string): RequestHandler {
  return (req, _res, next) => {
    try {
      const user = identity(req);
      if (!user.permissions.includes(permission))
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Your role does not allow ${permission.replaceAll(":", " ")}.`,
        );
      next();
    } catch (e) {
      next(e);
    }
  };
}
