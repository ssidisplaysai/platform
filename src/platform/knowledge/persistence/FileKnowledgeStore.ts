import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createDefaultKnowledgePersistedState,
  KnowledgeError,
  type KnowledgePersistedState,
} from "../contracts";
import type { KnowledgeStore } from "./types";

type FileKnowledgeStoreOptions = {
  rootDir: string;
};

function normalize(raw: unknown): KnowledgePersistedState {
  if (!raw || typeof raw !== "object") {
    throw new KnowledgeError("STATE_CORRUPT", "knowledge state must be an object", false, true, "CRITICAL");
  }

  const candidate = raw as Partial<KnowledgePersistedState>;
  if (candidate.schemaVersion !== "1.0.0") {
    throw new KnowledgeError("STATE_CORRUPT", "unsupported knowledge state schema", false, true, "CRITICAL");
  }

  if (!Array.isArray(candidate.knowledge)) {
    throw new KnowledgeError("STATE_CORRUPT", "knowledge state knowledge must be an array", false, true, "CRITICAL");
  }

  if (!Array.isArray(candidate.audits)) {
    throw new KnowledgeError("STATE_CORRUPT", "knowledge state audits must be an array", false, true, "CRITICAL");
  }

  const defaults = createDefaultKnowledgePersistedState();
  return {
    schemaVersion: "1.0.0",
    knowledge: candidate.knowledge,
    audits: candidate.audits,
    metrics: candidate.metrics ?? defaults.metrics,
  };
}

export class FileKnowledgeStore implements KnowledgeStore {
  private readonly filePath: string;
  private lock: Promise<void> = Promise.resolve();

  constructor(options: FileKnowledgeStoreOptions) {
    this.filePath = resolve(options.rootDir, "knowledge", "knowledge-state.v1.json");
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

  async load(): Promise<KnowledgePersistedState> {
    return this.withLock(async () => {
      try {
        const payload = await readFile(this.filePath, "utf8");
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload) as unknown;
        } catch {
          throw new KnowledgeError("STATE_CORRUPT", "knowledge state is not valid JSON", false, true, "CRITICAL");
        }
        return normalize(parsed);
      } catch (error) {
        if (error instanceof KnowledgeError) {
          throw error;
        }
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          const state = createDefaultKnowledgePersistedState();
          await this.ensureDir();
          await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
          return state;
        }
        throw new KnowledgeError("RECOVERY_FAILURE", "knowledge state read failed", false, true, "CRITICAL");
      }
    });
  }

  async save(state: KnowledgePersistedState): Promise<void> {
    return this.withLock(async () => {
      await this.ensureDir();
      await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
    });
  }
}
