import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Per-query logging in dev adds heavy console I/O to every request; opt in with PRISMA_LOG_QUERIES=1.
    log: process.env.PRISMA_LOG_QUERIES === "1" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
