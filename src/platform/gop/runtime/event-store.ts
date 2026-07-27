import { getPrismaClient } from "@/lib/glw/prisma";
import { createPrismaGenesisEventStore, type GenesisEventStore } from "@/platform/gop/event-store";

let singleton: GenesisEventStore | null = null;

export function getGenesisEventStore() {
  if (!singleton) {
    singleton = createPrismaGenesisEventStore(getPrismaClient());
  }

  return singleton;
}

export function setGenesisEventStoreForTests(store: GenesisEventStore): void {
  singleton = store;
}
