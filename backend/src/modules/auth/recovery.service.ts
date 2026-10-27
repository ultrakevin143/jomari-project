import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import type { Identity } from "../../shared/request-context.js";
import {
  hashPassword,
  newToken,
  tokenHash,
  verifyPassword,
} from "../../shared/security.js";
import { uuid } from "../../shared/validation.js";

const issueSchema = z
  .object({
    administratorPassword: z.string().min(1).max(128),
    verificationMethod: z.string().trim().min(8).max(120),
    reason: z.string().trim().min(8).max(500),
    verified: z.literal(true),
  })
  .strict();
const redeemSchema = z
  .object({
    code: z.string().min(40).max(100),
    password: z.string().min(12).max(128),
  })
  .strict();

export async function issueRecovery(
  db: PrismaClient,
  identity: Identity,
  requestId: string,
  targetId: unknown,
  input: unknown,
) {
  const id = uuid.parse(targetId),
    body = issueSchema.parse(input);
  if (id === identity.id)
    throw new ApiError(
      403,
      "SELF_RECOVERY",
      "Another administrator must verify your recovery.",
    );
  const admin = await db.user.findFirst({
    where: {
      id: identity.id,
      organizationId: identity.organizationId,
      active: true,
    },
    include: { role: true },
  });
  if (
    !admin ||
    admin.role.code !== "admin" ||
    !(await verifyPassword(body.administratorPassword, admin.passwordHash))
  )
    throw new ApiError(
      401,
      "REAUTHENTICATION_FAILED",
      "Administrator verification failed.",
    );
  const code = newToken(),
    expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-security:${id}`}))`;
    const target = await tx.user.findFirst({
      where: { id, organizationId: identity.organizationId, active: true },
    });
    if (!target)
      throw new ApiError(404, "NOT_FOUND", "Active account not found.");
    await tx.passwordRecovery.updateMany({
      where: { userId: id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.passwordRecovery.create({
      data: { userId: id, tokenHash: tokenHash(code), expiresAt },
    });
    await audit(tx, {
      organizationId: identity.organizationId,
      actorId: identity.id,
      actorName: identity.name,
      requestId,
      action: "PASSWORD_RECOVERY_ISSUED",
      entity: "user",
      entityId: id,
      reason: body.reason,
      metadata: { verificationMethod: body.verificationMethod },
    });
  });
  return { code, expiresAt };
}

export async function redeemRecovery(
  db: PrismaClient,
  requestId: string,
  input: unknown,
) {
  const body = redeemSchema.parse(input),
    hash = tokenHash(body.code);
  const passwordHash = await hashPassword(body.password);
  await db.$transaction(async (tx) => {
    let token = await tx.passwordRecovery.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (token) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-security:${token.userId}`}))`;
      token = await tx.passwordRecovery.findUnique({
        where: { tokenHash: hash },
        include: { user: true },
      });
    }
    if (
      !token ||
      token.usedAt ||
      token.expiresAt <= new Date() ||
      !token.user.active
    )
      throw new ApiError(
        400,
        "INVALID_RECOVERY",
        "Recovery code is invalid or expired.",
      );
    const consumed = await tx.passwordRecovery.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1)
      throw new ApiError(
        400,
        "INVALID_RECOVERY",
        "Recovery code is invalid or expired.",
      );
    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    });
    await tx.session.deleteMany({ where: { userId: token.userId } });
    await tx.passwordRecovery.updateMany({
      where: { userId: token.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await audit(tx, {
      organizationId: token.user.organizationId,
      actorId: token.userId,
      actorName: token.user.name,
      requestId,
      action: "PASSWORD_RECOVERY_COMPLETED",
      entity: "user",
      entityId: token.userId,
    });
  });
}
