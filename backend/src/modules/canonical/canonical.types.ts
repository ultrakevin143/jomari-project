import type { Prisma, PrismaClient } from "@prisma/client";

export type DB = PrismaClient | Prisma.TransactionClient;
export type Meta = {
  organizationId: string;
  sourceSystemId: string;
  sourceVersion: string;
};
