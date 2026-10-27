import { findLoginUser } from "./auth.repository.js";

import type { PrismaClient } from "@prisma/client";
import { type Config } from "../../config/env.js";
import { audit } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import type { Identity } from "../../shared/request-context.js";
import {
  hashPassword,
  newToken,
  tokenHash,
  verifyPassword,
} from "../../shared/security.js";
import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
import { loginSchema } from "./auth.schemas.js";
export function publicProfile(value: Identity | undefined) {
  const { sessionId: _sessionId, ...user } = requireIdentity(value);
  return user;
}
export function createAuthService(db: PrismaClient, config: Config) {
  let dummyHash: string | undefined;
  const login = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const { email, password } = loginSchema.parse(requestInput.body);
    const user = await findLoginUser(db, email);
    dummyHash ??= await hashPassword(newToken());
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? dummyHash,
    );
    if (
      !user ||
      !valid ||
      !user.active ||
      user.role.organizationId !== user.organizationId
    ) {
      if (user)
        await audit(db, {
          organizationId: user.organizationId,
          actorName: "Unauthenticated",
          action: "AUTH_LOGIN_FAILED",
          entity: "session",
          requestId: requestContext.requestId,
        });
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    }
    const token = newToken();
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600000);
    await db.$transaction(async (tx) => {
      if (requestContext.user)
        await tx.session.deleteMany({
          where: {
            id: requestContext.user.sessionId,
            userId: requestContext.user.id,
          },
        });
      await tx.session.create({
        data: { userId: user.id, tokenHash: tokenHash(token), expiresAt },
      });
      await audit(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorName: user.name,
        action: "AUTH_LOGIN",
        entity: "session",
        requestId: requestContext.requestId,
      });
    });
    return {
      payload: {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name,
          roleCode: user.role.code,
          organizationId: user.organizationId,
          permissions: user.role.permissions.map((p) => p.code),
        },
      },
      token,
      expiresAt,
    };
  };
  const currentUser = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return { data: publicProfile(requestContext.user) };
  };
  const refresh = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const user = requireIdentity(requestContext.user);
    const token = newToken();
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600000);
    await db.$transaction(async (tx) => {
      const deleted = await tx.session.deleteMany({
        where: { id: user.sessionId, userId: user.id },
      });
      if (deleted.count !== 1)
        throw new ApiError(
          401,
          "SESSION_REUSED",
          "Session already rotated. Sign in again.",
        );
      await tx.session.create({
        data: { userId: user.id, tokenHash: tokenHash(token), expiresAt },
      });
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "AUTH_REFRESH",
        entity: "session",
      });
    });
    return {
      payload: { data: publicProfile(requestContext.user) },
      token,
      expiresAt,
    };
  };
  const logout = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    if (requestContext.user)
      await db.$transaction(async (tx) => {
        await tx.session.deleteMany({
          where: {
            id: requestContext.user!.sessionId,
            userId: requestContext.user!.id,
          },
        });
        await audit(tx, {
          ...serviceAudit(requestContext.audit),
          action: "AUTH_LOGOUT",
          entity: "session",
        });
      });
    return undefined;
  };
  return { login, currentUser, refresh, logout };
}
