import "server-only";

import { createDecipheriv } from "node:crypto";
import { loadPersistedState } from "./foundation-persistence";

const PERSISTENCE_NAMESPACE = "wordpress-credential-store";
const ALGORITHM = "aes-256-gcm";

type EncryptedWordPressCredentialRecord = {
  reference: string;
  organizationId: string;
  siteId: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

type WordPressCredentialStoreState = {
  credentials: EncryptedWordPressCredentialRecord[];
};

export type ResolvedStoredWordPressCredential = {
  username: string;
  applicationPassword: string;
};

function resolveMasterKey(): Buffer {
  const encoded = process.env.GENESIS_CREDENTIAL_MASTER_KEY?.trim();
  if (!encoded) throw new Error("GENESIS_CREDENTIAL_MASTER_KEY is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("GENESIS_CREDENTIAL_MASTER_KEY must decode to exactly 32 bytes.");
  return key;
}

function loadCredential(reference: string): EncryptedWordPressCredentialRecord | null {
  const loaded = loadPersistedState<WordPressCredentialStoreState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: () => ({ credentials: [] }),
  });
  return loaded.state.credentials.find((record) => record.reference === reference) ?? null;
}

function decryptCredential(record: EncryptedWordPressCredentialRecord): ResolvedStoredWordPressCredential {
  const decipher = createDecipheriv(ALGORITHM, resolveMasterKey(), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext) as { username?: unknown; applicationPassword?: unknown };
  if (
    typeof parsed.username !== "string"
    || typeof parsed.applicationPassword !== "string"
    || !parsed.username.trim()
    || !parsed.applicationPassword.trim()
  ) {
    throw new Error("Stored WordPress credential is malformed.");
  }
  return { username: parsed.username, applicationPassword: parsed.applicationPassword };
}

export function resolveStoredWordPressCredentialForSite(input: {
  reference: string;
  organizationId: string;
  siteId: string;
}): ResolvedStoredWordPressCredential | null {
  const record = loadCredential(input.reference);
  if (!record) return null;
  if (record.organizationId !== input.organizationId || record.siteId !== input.siteId) {
    throw new Error("Credential reference belongs to another organization or site.");
  }
  return decryptCredential(record);
}