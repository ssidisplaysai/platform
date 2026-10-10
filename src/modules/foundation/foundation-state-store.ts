import {
  FoundationPersistenceError,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import { createPostgresFoundationStateStore } from "./postgres-foundation-state-store";

export interface FoundationStateLoad<T> {
  state: T;
  revision: number;
  seeded: boolean;
}

export interface FoundationStateStore {
  readonly backend: "filesystem" | "postgres";
  load<T>(input: {
    namespace: string;
    seedFactory: () => T;
  }): Promise<FoundationStateLoad<T>>;
  save<T>(input: {
    namespace: string;
    state: T;
    expectedRevision: number;
  }): Promise<{ revision: number }>;
  reset<T>(input: {
    namespace: string;
    seedFactory: () => T;
  }): Promise<{ state: T; revision: number }>;
  check(): Promise<void>;
  close(): Promise<void>;
}

const filesystemStore: FoundationStateStore = {
  backend: "filesystem",
  async load(input) {
    return loadPersistedState(input);
  },
  async save(input) {
    return savePersistedState(input);
  },
  async reset(input) {
    return resetPersistedState(input);
  },
  async check() {},
  async close() {},
};

let postgresStore: FoundationStateStore | undefined;
let loggedBackend: FoundationStateStore["backend"] | undefined;

export function getFoundationStateStore(): FoundationStateStore {
  const configured = process.env.GENESIS_STATE_BACKEND?.trim();
  const backend = configured || "filesystem";
  if (backend !== "filesystem" && backend !== "postgres") {
    console.error(JSON.stringify({
      event: "GENESIS_PERSISTENCE_BACKEND_UNSUPPORTED",
      backend,
    }));
    throw new FoundationPersistenceError(
      `Unsupported GENESIS_STATE_BACKEND value: ${backend}.`,
      "PERSISTENCE_BACKEND_UNSUPPORTED",
    );
  }

  if (backend === "filesystem") {
    if (loggedBackend !== backend) {
      console.info(JSON.stringify({
        event: "GENESIS_PERSISTENCE_BACKEND_SELECTED",
        backend,
      }));
      loggedBackend = backend;
    }
    return filesystemStore;
  }

  postgresStore ??= createPostgresFoundationStateStore();
  if (loggedBackend !== backend) {
    console.info(JSON.stringify({
      event: "GENESIS_PERSISTENCE_BACKEND_SELECTED",
      backend,
    }));
    loggedBackend = backend;
  }
  return postgresStore;
}

export async function checkFoundationStateStore(): Promise<void> {
  await getFoundationStateStore().check();
}

export async function closeFoundationStateStore(): Promise<void> {
  await postgresStore?.close();
}

export async function resetFoundationStateStoreForTests(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new FoundationPersistenceError(
      "Resetting the persistence backend is only supported in tests.",
      "PERSISTENCE_RESET_NOT_ALLOWED",
    );
  }
  await postgresStore?.close();
  postgresStore = undefined;
  loggedBackend = undefined;
}
