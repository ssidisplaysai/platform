import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createInMemoryBgeRepository, getBgeRepository, setBgeRepositoryForTests } from "@/lib/bge/repository";
import { createPrismaBgeRepository } from "@/lib/bge/prisma-repository";

jest.mock("@/lib/bge/prisma-repository", () => ({
  createPrismaBgeRepository: jest.fn(),
}));

describe("bge repository composition", () => {
  const mockedCreatePrismaBgeRepository = jest.mocked(createPrismaBgeRepository);

  beforeEach(() => {
    mockedCreatePrismaBgeRepository.mockReset();
    setBgeRepositoryForTests(null);
  });

  it("wires the default repository path to the Prisma-backed adapter", () => {
    const prismaRepository = createInMemoryBgeRepository();
    mockedCreatePrismaBgeRepository.mockReturnValue(prismaRepository);

    const repository = getBgeRepository();

    expect(mockedCreatePrismaBgeRepository).toHaveBeenCalledTimes(1);
    expect(repository).toBe(prismaRepository);
  });

  it("accepts a test double without invoking the Prisma-backed adapter", async () => {
    const inMemoryRepository = createInMemoryBgeRepository();
    setBgeRepositoryForTests(inMemoryRepository);

    const repository = getBgeRepository();
    const object = await repository.getObjectById("missing", "tenant_alpha");

    expect(object).toBeNull();
    expect(mockedCreatePrismaBgeRepository).not.toHaveBeenCalled();
  });
});