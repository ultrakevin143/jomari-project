import type { Prisma, PrismaClient } from "@prisma/client";

export type AuditInput = {
  organizationId: string;
  actorId?: string;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string;
  requestId: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
};
export async function audit(
  db: PrismaClient | Prisma.TransactionClient,
  input: AuditInput,
) {
  return db.auditEvent.create({
    data: { ...input, metadata: input.metadata ?? {} },
  });
}
