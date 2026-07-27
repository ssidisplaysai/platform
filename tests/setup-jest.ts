import { afterAll } from "@jest/globals";
import { disconnectPrismaClient } from "@/lib/glw/prisma";

afterAll(async () => {
  await disconnectPrismaClient();
});
