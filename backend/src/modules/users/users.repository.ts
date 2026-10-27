import type { Prisma, PrismaClient } from "@prisma/client";
export const fields = {
  id: true,
  name: true,
  email: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, code: true, name: true } },
} as const;
export function listRoles(db: PrismaClient, organizationId: string) {
  return db.role.findMany({
    where: { organizationId },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
}
export function listProfiles(
  db: PrismaClient,
  where: Prisma.UserWhereInput,
  page: { page: number; pageSize: number },
) {
  return db.$transaction([
    db.user.findMany({
      where,
      select: fields,
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
    db.user.count({ where }),
  ]);
}
