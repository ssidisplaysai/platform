import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import type { ResolvedWordPressCredential } from "./wordpress-credential-resolver";

const PERSISTENCE_NAMESPACE = "wordpress-credential-store";
const ALGORITHM = "aes-256-gcm";

type EncryptedWordPressCredentialRecord = {
  reference: string;
  organizationId: string;
  siteId: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  createdAt: string;
  updatedAt: string;
};

type WordPressCredentialStoreState = {
  credentials: EncryptedWordPressCredentialRecord[];
};

const credentialStore =
  new Map<string, EncryptedWordPressCredentialRecord>();

let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): WordPressCredentialStoreState {
  return {
    credentials: [],
  };
}

function applyState(state: WordPressCredentialStoreState): void {
  credentialStore.clear();

  state.credentials.forEach((credential) => {
    credentialStore.set(
      credential.reference,
      deepClone(credential),
    );
  });
}

function snapshotState(): WordPressCredentialStoreState {
  return {
    credentials: Array.from(credentialStore.values()).map(
      (credential) => deepClone(credential),
    ),
  };
}

function loadState(): void {
  const loaded =
    loadPersistedState<WordPressCredentialStoreState>({
      namespace: PERSISTENCE_NAMESPACE,
      seedFactory: createSeedState,
    });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistState(): void {
  const saved =
    savePersistedState<WordPressCredentialStoreState>({
      namespace: PERSISTENCE_NAMESPACE,
      state: snapshotState(),
      expectedRevision: stateRevision,
    });

  stateRevision = saved.revision;
}

function resolveMasterKey(): Buffer {
  const encoded =
    process.env.GENESIS_CREDENTIAL_MASTER_KEY?.trim();

  if (!encoded) {
    throw new Error(
      "GENESIS_CREDENTIAL_MASTER_KEY is not configured.",
    );
  }

  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error(
      "GENESIS_CREDENTIAL_MASTER_KEY must decode to exactly 32 bytes.",
    );
  }

  return key;
}

function encryptCredential(
  credential: ResolvedWordPressCredential,
): Pick<
  EncryptedWordPressCredentialRecord,
  "iv" | "authTag" | "ciphertext"
> {
  const key = resolveMasterKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv(
    ALGORITHM,
    key,
    iv,
  );

  const plaintext = JSON.stringify({
    username: credential.username.trim(),
    applicationPassword:
      credential.applicationPassword.replace(/\s+/g, ""),
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptCredential(
  record: EncryptedWordPressCredentialRecord,
): ResolvedWordPressCredential {
  const key = resolveMasterKey();

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(record.iv, "base64"),
  );

  decipher.setAuthTag(
    Buffer.from(record.authTag, "base64"),
  );

  const plaintext = Buffer.concat([
    decipher.update(
      Buffer.from(record.ciphertext, "base64"),
    ),
    decipher.final(),
  ]).toString("utf8");

  const parsed = JSON.parse(plaintext) as {
    username?: unknown;
    applicationPassword?: unknown;
  };

  if (
    typeof parsed.username !== "string" ||
    typeof parsed.applicationPassword !== "string" ||
    !parsed.username.trim() ||
    !parsed.applicationPassword.trim()
  ) {
    throw new Error(
      "Stored WordPress credential is malformed.",
    );
  }

  return {
    username: parsed.username,
    applicationPassword:
      parsed.applicationPassword,
  };
}

loadState();

export function storeWordPressCredential(input: {
  loadState();
  organizationId: string;
  siteId: string;
  username: string;
  applicationPassword: string;
  existingReference?: string | null;
}): {
  reference: string;
} {
  const username = input.username.trim();
  const applicationPassword =
    input.applicationPassword.replace(/\s+/g, "");

  if (!username || !applicationPassword) {
    throw new Error(
      "WordPress username and application password are required.",
    );
  }

  const reference =
    input.existingReference?.startsWith("credref-wp-")
      ? input.existingReference
      : `credref-wp-${randomUUID()}`;

  const existing = credentialStore.get(reference);

  if (
    existing &&
    (
      existing.organizationId !== input.organizationId ||
      existing.siteId !== input.siteId
    )
  ) {
    throw new Error(
      "Credential reference belongs to another site.",
    );
  }

  const timestamp = nowIso();

  const encrypted = encryptCredential({
    username,
    applicationPassword,
  });

  credentialStore.set(reference, {
    reference,
    organizationId: input.organizationId,
    siteId: input.siteId,
    ...encrypted,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });

  persistState();

  return {
    reference,
  };
}

export function resolveStoredWordPressCredential(
  reference: string,
): ResolvedWordPressCredential | null {
  loadState();
  const record = credentialStore.get(reference);

  if (!record) {
    return null;
  }

  return decryptCredential(record);
}

export function hasStoredWordPressCredential(
  reference: string | null,
): boolean {
  loadState();
  return Boolean(
    reference &&
    credentialStore.has(reference),
  );
}