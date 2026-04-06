import { PrismaClient } from "@prisma/client";

declare global {
  var __clearallerPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__clearallerPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__clearallerPrisma = prisma;
}
