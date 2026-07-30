import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createPrismaExecutionRepository } from "@/platform/gop/persistence/prisma-execution-repository";
import { getPlatformPrismaClient } from "@/platform/gop/runtime/prisma";

jest.mock("@/platform/gop/runtime/prisma", () => ({
  getPlatformPrismaClient: jest.fn(),
}));

describe("gop prisma execution repository composition", () => {
  const mockedGetPlatformPrismaClient = jest.mocked(getPlatformPrismaClient);

  beforeEach(() => {
    mockedGetPlatformPrismaClient.mockReset();
  });

  it("uses platform Prisma client by default", async () => {
    const prisma = {
      gopExecution: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as never;

    mockedGetPlatformPrismaClient.mockReturnValue(prisma);

    const repository = createPrismaExecutionRepository();
    await repository.loadExecution("exec-default");

    expect(mockedGetPlatformPrismaClient).toHaveBeenCalledTimes(1);
    expect(prisma.gopExecution.findUnique).toHaveBeenCalledWith({ where: { executionId: "exec-default" } });
  });

  it("accepts an explicit repository persistence client without using default runtime provider", async () => {
    const explicitPrisma = {
      gopExecution: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as never;

    const repository = createPrismaExecutionRepository(explicitPrisma);
    await repository.loadExecution("exec-explicit");

    expect(mockedGetPlatformPrismaClient).not.toHaveBeenCalled();
    expect(explicitPrisma.gopExecution.findUnique).toHaveBeenCalledWith({ where: { executionId: "exec-explicit" } });
  });
});
