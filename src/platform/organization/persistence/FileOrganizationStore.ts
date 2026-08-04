import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { OrganizationPersistedState } from "../contracts";
import { createDefaultPersistedState } from "../contracts";
import type { OrganizationPersistence } from "./types";

type FileStoreOptions = {
  rootDir: string;
};

function normalize(raw: unknown): OrganizationPersistedState {
  if (typeof raw !== "object" || raw === null) {
    return createDefaultPersistedState();
  }

  const candidate = raw as Partial<OrganizationPersistedState>;
  if (candidate.schemaVersion !== "1.0.0") {
    return createDefaultPersistedState();
  }

  return {
    schemaVersion: "1.0.0",
    organizations: Array.isArray(candidate.organizations) ? candidate.organizations : [],
    hierarchy: Array.isArray(candidate.hierarchy) ? candidate.hierarchy : [],
    relationships: Array.isArray(candidate.relationships) ? candidate.relationships : [],
    audits: Array.isArray(candidate.audits) ? candidate.audits : [],
    metrics: candidate.metrics ?? createDefaultPersistedState().metrics,
  };
}

export class FileOrganizationStore implements OrganizationPersistence {
  private readonly filePath: string;
  private lock: Promise<void> = Promise.resolve();

  constructor(options: FileStoreOptions) {
    this.filePath = resolve(options.rootDir, "organization", "organization-state.v1.json");
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

  async load(): Promise<OrganizationPersistedState> {
    return this.withLock(async () => {
      try {
        const payload = await readFile(this.filePath, "utf8");
        const parsed = JSON.parse(payload) as unknown;
        return normalize(parsed);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          const state = createDefaultPersistedState();
          await this.ensureDir();
          await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
          return state;
        }
        return createDefaultPersistedState();
      }
    });
  }

  async save(state: OrganizationPersistedState): Promise<void> {
    return this.withLock(async () => {
      await this.ensureDir();
      await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
    });
  }
}
