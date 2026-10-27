import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import type { Identity } from "../../shared/request-context.js";
import { hashPassword, verifyPassword } from "../../shared/security.js";
import { uuid } from "../../shared/validation.js";

const answer = z.string().trim().min(3).max(128);
const question = z.string().trim().min(8).max(180);
const password = z.string().min(1).max(128);
const setupSchema = z
  .object({
    currentPassword: password,
    question,
    answer,
    currentAnswer: answer.optional(),
  })
  .strict();
const changeSchema = z
  .object({
    currentPassword: password,
    newPassword: z.string().min(12).max(128),
    answer,
  })
  .strict();
const adminSchema = z
  .object({
    administratorPassword: password,
    verificationMethod: z.string().trim().min(8).max(120),
    reason: z.string().trim().min(8).max(500),
    verified: z.literal(true),
    question,
    answer,
  })
  .strict();
const normalize = (s: string) =>
  s.normalize("NFKC").trim().toLocaleLowerCase("en-US");
const denied = () =>
  new ApiError(
    401,
    "VERIFICATION_FAILED",
    "Password or security answer is incorrect.",
  );

export async function getQuestion(db: PrismaClient, user: Identity) {
  const record = await db.securityQuestion.findUnique({
    where: { userId: user.id },
    select: { question: true },
  });
  return record;
}
export async function setupQuestion(
  db: PrismaClient,
  user: Identity,
  requestId: string,
  input: unknown,
) {
  const body = setupSchema.parse(input),
    answerHash = await hashPassword(normalize(body.answer));
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-security:${user.id}`}))`;
    const account = await tx.user.findFirst({
      where: { id: user.id, organizationId: user.organizationId, active: true },
    });
    const session = await tx.session.findFirst({
      where: {
        id: user.sessionId,
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
    });
    const old = await tx.securityQuestion.findUnique({
      where: { userId: user.id },
    });
    if (
      !account ||
      !session ||
      !(await verifyPassword(body.currentPassword, account.passwordHash)) ||
      (old &&
        (!body.currentAnswer ||
          !(await verifyPassword(
            normalize(body.currentAnswer),
            old.answerHash,
          ))))
    )
      throw denied();
    await tx.securityQuestion.upsert({
      where: { userId: user.id },
      create: { userId: user.id, question: body.question, answerHash },
      update: { question: body.question, answerHash },
    });
    await audit(tx, {
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      requestId,
      action: "SECURITY_QUESTION_UPDATED",
      entity: "user",
      entityId: user.id,
    });
  });
}
export async function changePassword(
  db: PrismaClient,
  user: Identity,
  requestId: string,
  input: unknown,
) {
  const body = changeSchema.parse(input);
  if (body.currentPassword === body.newPassword)
    throw new ApiError(
      422,
      "PASSWORD_UNCHANGED",
      "Choose a different password.",
    );
  const newHash = await hashPassword(body.newPassword);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-security:${user.id}`}))`;
    const account = await tx.user.findFirst({
      where: { id: user.id, organizationId: user.organizationId, active: true },
    });
    const session = await tx.session.findFirst({
      where: {
        id: user.sessionId,
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
    });
    const record = await tx.securityQuestion.findUnique({
      where: { userId: user.id },
    });
    if (
      !account ||
      !session ||
      !record ||
      !(await verifyPassword(body.currentPassword, account.passwordHash)) ||
      !(await verifyPassword(normalize(body.answer), record.answerHash))
    )
      throw denied();
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.passwordRecovery.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await audit(tx, {
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      requestId,
      action: "PASSWORD_CHANGED",
      entity: "user",
      entityId: user.id,
    });
  });
}
export async function adminResetQuestion(
  db: PrismaClient,
  admin: Identity,
  requestId: string,
  targetId: unknown,
  input: unknown,
) {
  const id = uuid.parse(targetId),
    body = adminSchema.parse(input);
  if (id === admin.id)
    throw new ApiError(403, "SELF_RESET", "Use your own security settings.");
  const actor = await db.user.findFirst({
    where: { id: admin.id, organizationId: admin.organizationId, active: true },
    include: { role: true },
  });
  if (
    !actor ||
    actor.role.code !== "admin" ||
    !(await verifyPassword(body.administratorPassword, actor.passwordHash))
  )
    throw denied();
  const answerHash = await hashPassword(normalize(body.answer));
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-security:${id}`}))`;
    const target = await tx.user.findFirst({
      where: { id, organizationId: admin.organizationId, active: true },
    });
    if (!target)
      throw new ApiError(404, "NOT_FOUND", "Active account not found.");
    await tx.securityQuestion.upsert({
      where: { userId: id },
      create: { userId: id, question: body.question, answerHash },
      update: { question: body.question, answerHash },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.passwordRecovery.updateMany({
      where: { userId: id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await audit(tx, {
      organizationId: admin.organizationId,
      actorId: admin.id,
      actorName: admin.name,
      requestId,
      action: "SECURITY_QUESTION_ADMIN_RESET",
      entity: "user",
      entityId: id,
      reason: body.reason,
      metadata: { verificationMethod: body.verificationMethod },
    });
  });
}
