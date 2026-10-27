import type { PrismaClient } from "@prisma/client";
export function findLoginUser(db: PrismaClient, email: string) {
  return db.user.findUnique({
    where: { email },
    include: { role: { include: { permissions: true } } },
  });
}
export function findSession(db: PrismaClient, tokenHash: string) {
  return db.session.findUnique({
    where: { tokenHash },
    include: {
      user: { include: { role: { include: { permissions: true } } } },
    },
  });
}
