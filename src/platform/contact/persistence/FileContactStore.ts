import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createDefaultContactPersistedState,
  type ContactPersistedState,
} from "../contracts";
import type { ContactStore } from "./types";

type FileContactStoreOptions = {
  rootDir: string;
};

function normalize(raw: unknown): ContactPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultContactPersistedState();
  }

  const candidate = raw as Partial<ContactPersistedState>;
  if (candidate.schemaVersion !== "1.0.0") {
    return createDefaultContactPersistedState();
  }

  return {
    schemaVersion: "1.0.0",
    contacts: Array.isArray(candidate.contacts) ? candidate.contacts : [],
    audits: Array.isArray(candidate.audits) ? candidate.audits : [],
    metrics: candidate.metrics ?? createDefaultContactPersistedState().metrics,
    duplicateBacklog: Array.isArray(candidate.duplicateBacklog) ? candidate.duplicateBacklog : [],
  };
}

export class FileContactStore implements ContactStore {
  private readonly filePath: string;
  private lock: Promise<void> = Promise.resolve();

  constructor(options: FileContactStoreOptions) {
    this.filePath = resolve(options.rootDir, "contact", "contact-state.v1.json");
  }

  private async ensureDir(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const wait = this.lock;
    let release: () => void = () => undefined;
    this.lock = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await wait;

    try {
      return await operation();
    } finally {
      release();
    }
  }

  async load(): Promise<ContactPersistedState> {
    return this.withLock(async () => {
      try {
        const payload = await readFile(this.filePath, "utf8");
        return normalize(JSON.parse(payload) as unknown);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          const state = createDefaultContactPersistedState();
          await this.ensureDir();
          await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
          return state;
        }

        return createDefaultContactPersistedState();
      }
    });
  }

  async save(state: ContactPersistedState): Promise<void> {
    return this.withLock(async () => {
      await this.ensureDir();
      await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
    });
  }
}
