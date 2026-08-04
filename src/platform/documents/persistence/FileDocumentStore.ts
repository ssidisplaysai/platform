import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createDefaultDocumentPersistedState, type DocumentPersistedState } from "../contracts";
import type { DocumentStore } from "./types";

type FileDocumentStoreOptions = {
  rootDir: string;
};

function normalize(raw: unknown): DocumentPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultDocumentPersistedState();
  }

  const candidate = raw as Partial<DocumentPersistedState>;
  if (candidate.schemaVersion !== "1.0.0") {
    return createDefaultDocumentPersistedState();
  }

  const defaults = createDefaultDocumentPersistedState();
  return {
    schemaVersion: "1.0.0",
    documents: Array.isArray(candidate.documents) ? candidate.documents : [],
    templates: Array.isArray(candidate.templates) ? candidate.templates : [],
    relationships: Array.isArray(candidate.relationships) ? candidate.relationships : [],
    assetReferences: Array.isArray(candidate.assetReferences) ? candidate.assetReferences : [],
    audits: Array.isArray(candidate.audits) ? candidate.audits : [],
    metrics: candidate.metrics ?? defaults.metrics,
  };
}

export class FileDocumentStore implements DocumentStore {
  private readonly filePath: string;
  private lock: Promise<void> = Promise.resolve();

  constructor(options: FileDocumentStoreOptions) {
    this.filePath = resolve(options.rootDir, "documents", "document-state.v1.json");
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

  async load(): Promise<DocumentPersistedState> {
    return this.withLock(async () => {
      try {
        const payload = await readFile(this.filePath, "utf8");
        return normalize(JSON.parse(payload) as unknown);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          const state = createDefaultDocumentPersistedState();
          await this.ensureDir();
          await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
          return state;
        }
        return createDefaultDocumentPersistedState();
      }
    });
  }

  async save(state: DocumentPersistedState): Promise<void> {
    return this.withLock(async () => {
      await this.ensureDir();
      await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
    });
  }
}
