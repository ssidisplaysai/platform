import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  genesisPlatformPrisma?: PrismaClient;
};

export function getPlatformPrismaClient(): PrismaClient {
  if (!globalForPrisma.genesisPlatformPrisma) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required to use Genesis platform persistence.");
    }

    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.genesisPlatformPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.genesisPlatformPrisma;
}

export async function disconnectPlatformPrismaClient(): Promise<void> {
  if (!globalForPrisma.genesisPlatformPrisma) {
    return;
  }

  await globalForPrisma.genesisPlatformPrisma.$disconnect();
  delete globalForPrisma.genesisPlatformPrisma;
}
