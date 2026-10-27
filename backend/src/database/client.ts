import { PrismaClient } from "@prisma/client";
export const createDatabase = () => new PrismaClient();
