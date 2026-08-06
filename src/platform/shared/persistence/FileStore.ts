import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { PersistedEnvelope, SharedStore } from "./types";

type FileStoreOptions<TPayload> = {
  rootDir: string;
  namespace: string;
  fileName: string;
  createDefaultState(): PersistedEnvelope<TPayload>;
  normalize(raw: unknown): PersistedEnvelope<TPayload>;
};

export class FileStore<TPayload> implements SharedStore<TPayload> {
  private readonly filePath: string;
  private lock: Promise<void> = Promise.resolve();

  constructor(private readonly options: FileStoreOptions<TPayload>) {
    this.filePath = resolve(options.rootDir, options.namespace, options.fileName);
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  private async withLock<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
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

  async load(): Promise<PersistedEnvelope<TPayload>> {
    return this.withLock(async () => {
      try {
        const payload = await readFile(this.filePath, "utf8");
        const parsed = JSON.parse(payload) as unknown;
        return this.options.normalize(parsed);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          const state = this.options.createDefaultState();
          await this.ensureDirectory();
          await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
          return state;
        }

        if (error instanceof SyntaxError) {
          throw new Error("persisted state is not valid JSON");
        }

        throw error;
      }
    });
  }

  async save(state: PersistedEnvelope<TPayload>): Promise<void> {
    return this.withLock(async () => {
      await this.ensureDirectory();
      await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
    });
  }
}
