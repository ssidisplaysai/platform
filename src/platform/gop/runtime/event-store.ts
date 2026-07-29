import type { GenesisEventStore } from "@/platform/gop/event-store";
import { createPrismaGenesisEventStore } from "@/platform/gop/persistence/prisma-event-store";
import { getPlatformPrismaClient } from "./prisma";

let singleton: GenesisEventStore | null = null;

export function getGenesisEventStore() {
  if (!singleton) {
    singleton = createPrismaGenesisEventStore(getPlatformPrismaClient());
  }

  return singleton;
}

export function setGenesisEventStoreForTests(store: GenesisEventStore): void {
  singleton = store;
}

export function resetGenesisEventStoreForTests(): void {
  singleton = null;
}
