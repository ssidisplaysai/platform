import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getGenesisOrchestrationRuntime, setGenesisOrchestrationRuntimeForTests } from "@/platform/gop/runtime/orchestration-runtime";
import { createPrismaExecutionRepository } from "@/platform/gop/persistence/prisma-execution-repository";
import { createGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestrator";

jest.mock("@/platform/gop/persistence/prisma-execution-repository", () => ({
  createPrismaExecutionRepository: jest.fn(),
}));

jest.mock("@/platform/gop/runtime/orchestrator", () => ({
  createGenesisOrchestrationRuntime: jest.fn(),
}));

describe("gop orchestration runtime composition", () => {
  const mockedCreatePrismaExecutionRepository = jest.mocked(createPrismaExecutionRepository);
  const mockedCreateGenesisOrchestrationRuntime = jest.mocked(createGenesisOrchestrationRuntime);

  beforeEach(() => {
    mockedCreatePrismaExecutionRepository.mockReset();
    mockedCreateGenesisOrchestrationRuntime.mockReset();
    setGenesisOrchestrationRuntimeForTests(null);
  });

  it("binds default runtime to Prisma execution repository implementation", () => {
    const repository = { marker: "repo" } as never;
    const runtime = { marker: "runtime" } as never;

    mockedCreatePrismaExecutionRepository.mockReturnValue(repository);
    mockedCreateGenesisOrchestrationRuntime.mockReturnValue(runtime);

    const loaded = getGenesisOrchestrationRuntime();

    expect(mockedCreatePrismaExecutionRepository).toHaveBeenCalledTimes(1);
    expect(mockedCreateGenesisOrchestrationRuntime).toHaveBeenCalledWith({ repository });
    expect(loaded).toBe(runtime);
  });

  it("reuses singleton runtime instance across repeated calls", () => {
    const repository = { marker: "repo" } as never;
    const runtime = { marker: "runtime" } as never;

    mockedCreatePrismaExecutionRepository.mockReturnValue(repository);
    mockedCreateGenesisOrchestrationRuntime.mockReturnValue(runtime);

    const first = getGenesisOrchestrationRuntime();
    const second = getGenesisOrchestrationRuntime();

    expect(first).toBe(second);
    expect(mockedCreatePrismaExecutionRepository).toHaveBeenCalledTimes(1);
    expect(mockedCreateGenesisOrchestrationRuntime).toHaveBeenCalledTimes(1);
  });
});
