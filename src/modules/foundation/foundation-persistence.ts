import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const PERSISTENCE_SCHEMA_VERSION = 1;
const DEFAULT_PERSISTENCE_DIR = ".gcp-foundation-data";

type PersistenceEnvelope<T> = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  data: T;
};

export class FoundationPersistenceError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "FoundationPersistenceError";
    this.code = code;
  }
}

export class FoundationPersistenceConflictError extends FoundationPersistenceError {
  constructor(message: string) {
    super(message, "PERSISTENCE_CONFLICT");
    this.name = "FoundationPersistenceConflictError";
  }
}

export class FoundationPersistenceSerializationError extends FoundationPersistenceError {
  constructor(message: string) {
    super(message, "PERSISTENCE_SERIALIZATION_ERROR");
    this.name = "FoundationPersistenceSerializationError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolvePersistenceRoot(): string {
  const fromEnv = process.env.GCP_FOUNDATION_PERSISTENCE_DIR?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  if (process.env.NODE_ENV === "test") {
    const workerId = process.env.JEST_WORKER_ID ?? "0";
    return join(process.cwd(), `${DEFAULT_PERSISTENCE_DIR}-test-${workerId}`);
  }

  return join(process.cwd(), DEFAULT_PERSISTENCE_DIR);
}

function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

function namespaceFile(namespace: string): string {
  const root = resolvePersistenceRoot();
  ensureDirectory(root);
  return join(root, `${namespace}.json`);
}

function readEnvelopeFromDisk<T>(filePath: string): PersistenceEnvelope<T> | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as PersistenceEnvelope<T>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.schemaVersion !== "number" ||
      typeof parsed.revision !== "number" ||
      typeof parsed.updatedAt !== "string" ||
      !("data" in parsed)
    ) {
      throw new FoundationPersistenceSerializationError(
        `Persistence envelope for ${filePath} is malformed.`,
      );
    }

    if (parsed.schemaVersion !== PERSISTENCE_SCHEMA_VERSION) {
      throw new FoundationPersistenceSerializationError(
        `Unsupported persistence schema version ${parsed.schemaVersion} for ${filePath}.`,
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof FoundationPersistenceError) {
      throw error;
    }

    throw new FoundationPersistenceSerializationError(
      `Failed to parse persisted state at ${filePath}: ${(error as Error).message}`,
    );
  }
}

function atomicWriteEnvelope<T>(filePath: string, envelope: PersistenceEnvelope<T>): void {
  const tempPath = `${filePath}.tmp`;
  ensureDirectory(dirname(filePath));

  try {
    writeFileSync(tempPath, JSON.stringify(envelope, null, 2), "utf-8");

    // On Windows, rename over an existing file can throw EPERM.
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    renameSync(tempPath, filePath);
  } catch (error) {
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }

    throw new FoundationPersistenceError(
      `Failed to write persisted state at ${filePath}: ${(error as Error).message}`,
      "PERSISTENCE_WRITE_FAILED",
    );
  }
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function loadPersistedState<T>(input: {
  namespace: string;
  seedFactory: () => T;
}): {
  state: T;
  revision: number;
  seeded: boolean;
} {
  const filePath = namespaceFile(input.namespace);
  const envelope = readEnvelopeFromDisk<T>(filePath);

  if (envelope) {
    return {
      state: deepClone(envelope.data),
      revision: envelope.revision,
      seeded: false,
    };
  }

  const seeded = input.seedFactory();
  const revision = 0;
  const initialEnvelope: PersistenceEnvelope<T> = {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    revision,
    updatedAt: nowIso(),
    data: deepClone(seeded),
  };

  atomicWriteEnvelope(filePath, initialEnvelope);

  return {
    state: deepClone(seeded),
    revision,
    seeded: true,
  };
}

export function savePersistedState<T>(input: {
  namespace: string;
  state: T;
  expectedRevision: number;
}): {
  revision: number;
} {
  const filePath = namespaceFile(input.namespace);
  const existing = readEnvelopeFromDisk<T>(filePath);
  const currentRevision = existing?.revision ?? -1;

  if (currentRevision !== input.expectedRevision) {
    throw new FoundationPersistenceConflictError(
      `Revision conflict for ${input.namespace}: expected ${input.expectedRevision}, found ${currentRevision}.`,
    );
  }

  const nextRevision = currentRevision + 1;
  const envelope: PersistenceEnvelope<T> = {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    revision: nextRevision,
    updatedAt: nowIso(),
    data: deepClone(input.state),
  };

  atomicWriteEnvelope(filePath, envelope);
  return { revision: nextRevision };
}

export function resetPersistedState<T>(input: {
  namespace: string;
  seedFactory: () => T;
}): {
  state: T;
  revision: number;
} {
  const filePath = namespaceFile(input.namespace);
  const seeded = input.seedFactory();
  const envelope: PersistenceEnvelope<T> = {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    revision: 0,
    updatedAt: nowIso(),
    data: deepClone(seeded),
  };

  atomicWriteEnvelope(filePath, envelope);

  return {
    state: deepClone(seeded),
    revision: 0,
  };
}
