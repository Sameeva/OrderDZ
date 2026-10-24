import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export function createPrisma(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** One client per server instance (hot reload and serverless safe). */
export function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= createPrisma();
  return globalForPrisma.prisma;
}
