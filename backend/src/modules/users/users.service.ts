import {
  fields,
  listProfiles,
  listRoles as listUserRoles,
} from "./users.repository.js";

import type { PrismaClient } from "@prisma/client";
import { audit } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import { hashPassword } from "../../shared/security.js";
import { pageResponse, paging, uuid } from "../../shared/validation.js";
import { createUserSchema, updateUserSchema } from "./users.schemas.js";

import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";

export function createUsersService(db: PrismaClient) {
  const listRoles = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return {
      data: await listUserRoles(
        db,
        requireIdentity(requestContext.user).organizationId,
      ),
    };
  };
  const listUsers = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const q = paging.parse(requestInput.query),
      organizationId = requireIdentity(requestContext.user).organizationId;
    const where = {
      organizationId,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { email: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await listProfiles(db, where, q);
    return pageResponse(rows, total, q.page, q.pageSize);
  };
  const createUser = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const body = createUserSchema.parse(requestInput.body);
    const context = serviceAudit(requestContext.audit),
      passwordHash = await hashPassword(body.password);
    const role = await db.role.findFirst({
      where: { id: body.roleId, organizationId: context.organizationId },
    });
    if (!role)
      throw new ApiError(
        422,
        "INVALID_ROLE",
        "Choose a role belonging to this municipal workspace.",
      );
    try {
      const data = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            organizationId: context.organizationId,
            name: body.name,
            email: body.email,
            passwordHash,
            roleId: role.id,
          },
          select: fields,
        });
        await audit(tx, {
          ...context,
          action: "USER_CREATED",
          entity: "user",
          entityId: user.id,
          reason: body.reason,
          metadata: { role: role.code },
        });
        return user;
      });
      return { data };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "P2002"
      )
        throw new ApiError(
          409,
          "EMAIL_UNAVAILABLE",
          "That email cannot be used. Choose another address.",
        );
      throw err;
    }
  };
  const updateUser = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const id = uuid.parse(requestInput.params.id),
      context = serviceAudit(requestContext.audit);
    const body = updateUserSchema.parse(requestInput.body);
    const data = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`users:${context.organizationId}`}))`;
      const target = await tx.user.findFirst({
        where: { id, organizationId: context.organizationId },
        include: { role: true },
      });
      if (!target)
        throw new ApiError(
          404,
          "NOT_FOUND",
          "User not found in this municipal workspace.",
        );
      if (target.updatedAt.toISOString() !== body.updatedAt)
        throw new ApiError(
          409,
          "STALE_USER",
          "This account changed. Refresh and review it before saving.",
        );
      const role = await tx.role.findFirst({
        where: { id: body.roleId, organizationId: context.organizationId },
      });
      if (!role)
        throw new ApiError(
          422,
          "INVALID_ROLE",
          "Choose a role belonging to this municipal workspace.",
        );
      if (id === context.actorId && (!body.active || role.id !== target.roleId))
        throw new ApiError(
          409,
          "SELF_LOCKOUT",
          "Another administrator must change your role or deactivate your account.",
        );
      if (
        target.active &&
        target.role.code === "admin" &&
        (!body.active || role.code !== "admin") &&
        (await tx.user.count({
          where: {
            organizationId: context.organizationId,
            active: true,
            role: { code: "admin" },
          },
        })) <= 1
      )
        throw new ApiError(
          409,
          "LAST_ADMIN",
          "Keep at least one active administrator.",
        );
      const user = await tx.user.update({
        where: { id },
        data: { name: body.name, roleId: role.id, active: body.active },
        select: fields,
      });
      if (target.roleId !== role.id || target.active !== body.active)
        await tx.session.deleteMany({ where: { userId: id } });
      await audit(tx, {
        ...context,
        action: "USER_UPDATED",
        entity: "user",
        entityId: id,
        reason: body.reason,
        metadata: {
          previousRole: target.role.code,
          role: role.code,
          active: body.active,
          sessionsRevoked:
            target.roleId !== role.id || target.active !== body.active,
        },
      });
      return user;
    });
    return { data };
  };
  return { listRoles, listUsers, createUser, updateUser };
}
