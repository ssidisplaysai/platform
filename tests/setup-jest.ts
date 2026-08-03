import { afterAll, jest } from "@jest/globals";

jest.mock("@/lib/glw/prisma", () => ({
  getPrismaClient: () => ({
    $queryRaw: async () => [],
  }),
  disconnectPrismaClient: async () => undefined,
}));

import { disconnectPrismaClient } from "@/lib/glw/prisma";

afterAll(async () => {
  await disconnectPrismaClient();
});
