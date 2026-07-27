import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required to use GLW persistence.");
    }

    const adapter = new PrismaPg({ connectionString });

    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!globalForPrisma.prisma) {
    return;
  }

  await globalForPrisma.prisma.$disconnect();
  delete globalForPrisma.prisma;
}
