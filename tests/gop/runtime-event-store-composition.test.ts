import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createInMemoryGenesisEventStore } from "@/platform/gop/event-store";
import {
  getGenesisEventStore,
  resetGenesisEventStoreForTests,
  setGenesisEventStoreForTests,
} from "@/platform/gop/runtime/event-store";
import { createPrismaGenesisEventStore } from "@/platform/gop/persistence/prisma-event-store";
import { getPlatformPrismaClient } from "@/platform/gop/runtime/prisma";

jest.mock("@/platform/gop/persistence/prisma-event-store", () => ({
  createPrismaGenesisEventStore: jest.fn(),
}));

jest.mock("@/platform/gop/runtime/prisma", () => ({
  getPlatformPrismaClient: jest.fn(),
}));

describe("gop runtime event-store composition", () => {
  const mockedCreatePrismaGenesisEventStore = jest.mocked(createPrismaGenesisEventStore);
  const mockedGetPlatformPrismaClient = jest.mocked(getPlatformPrismaClient);

  beforeEach(() => {
    mockedCreatePrismaGenesisEventStore.mockReset();
    mockedGetPlatformPrismaClient.mockReset();
    resetGenesisEventStoreForTests();
  });

  it("wires default runtime path to Prisma-backed event store implementation", () => {
    const prismaClient = { marker: "prisma-client" } as never;
    const prismaBackedStore = createInMemoryGenesisEventStore();

    mockedGetPlatformPrismaClient.mockReturnValue(prismaClient);
    mockedCreatePrismaGenesisEventStore.mockReturnValue(prismaBackedStore);

    const store = getGenesisEventStore();

    expect(mockedGetPlatformPrismaClient).toHaveBeenCalledTimes(1);
    expect(mockedCreatePrismaGenesisEventStore).toHaveBeenCalledWith(prismaClient);
    expect(store).toBe(prismaBackedStore);
  });

  it("accepts a test double without requiring Prisma", async () => {
    const storeDouble = createInMemoryGenesisEventStore();
    setGenesisEventStoreForTests(storeDouble);

    const store = getGenesisEventStore();
    await store.appendEvent({
      jobId: "job-double",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      type: "JOB_CREATED",
      label: "Job Created",
      occurredAt: "2026-07-26T10:00:00.000Z",
      status: "QUEUED",
    });

    const events = await store.listEventsForJob("job-double");

    expect(events).toHaveLength(1);
    expect(mockedGetPlatformPrismaClient).not.toHaveBeenCalled();
    expect(mockedCreatePrismaGenesisEventStore).not.toHaveBeenCalled();
  });
});
