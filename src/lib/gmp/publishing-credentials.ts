import "server-only";
import { createHash } from "node:crypto";
import type { GmpPublishingDestination } from "./publishing-models";

export type GmpResolvedDestinationCredential = {
  username: string;
  applicationPassword: string;
  source: string;
  resolvedAt: string;
};

export type GmpDestinationCredentialProvider = {
  resolveDestinationCredential: (destination: GmpPublishingDestination) => Promise<GmpResolvedDestinationCredential | null>;
  validateDestinationCredential: (destination: GmpPublishingDestination) => Promise<{ ok: boolean; reason?: string }>;
  invalidateDestinationCredentialCache: (credentialReference?: string) => void;
};

type CacheEntry = {
  cacheKey: string;
  credential: GmpResolvedDestinationCredential;
};

const cache = new Map<string, CacheEntry>();

function parseCredentialSecret(rawValue: string): { username: string; applicationPassword: string } | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    let decoded: Record<string, unknown>;
    try {
      decoded = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return null;
    }
    const username = typeof decoded.username === "string"
      ? decoded.username
      : typeof decoded.user === "string"
        ? decoded.user
        : "";
    const applicationPassword = typeof decoded.applicationPassword === "string"
      ? decoded.applicationPassword
      : typeof decoded.password === "string"
        ? decoded.password
        : "";

    if (!username || !applicationPassword) return null;
    return { username, applicationPassword };
  }

  const [username, ...passwordParts] = trimmed.split(":");
  const applicationPassword = passwordParts.join(":");
  if (!username || !applicationPassword) return null;
  return { username: username.trim(), applicationPassword: applicationPassword.trim() };
}

function getCredentialReferenceName(destination: GmpPublishingDestination): string | null {
  const reference = destination.credentialReference?.trim();
  if (!reference) return null;
  return reference.startsWith("env:") ? reference.slice(4).trim() : reference;
}

function buildCacheKey(referenceName: string, envValue: string): string {
  return createHash("sha256").update(`${referenceName}:${envValue}`).digest("hex");
}

export function createEnvironmentDestinationCredentialProvider(): GmpDestinationCredentialProvider {
  return {
    async resolveDestinationCredential(destination) {
      const referenceName = getCredentialReferenceName(destination);
      if (!referenceName) return null;

      const envValue = process.env[referenceName];
      if (!envValue) return null;

      const cacheKey = buildCacheKey(referenceName, envValue);
      const existing = cache.get(referenceName);
      if (existing && existing.cacheKey === cacheKey) {
        return existing.credential;
      }

      const parsed = parseCredentialSecret(envValue);
      if (!parsed) return null;

      const credential: GmpResolvedDestinationCredential = {
        username: parsed.username,
        applicationPassword: parsed.applicationPassword,
        source: `env:${referenceName}`,
        resolvedAt: new Date().toISOString(),
      };

      cache.set(referenceName, { cacheKey, credential });
      return credential;
    },

    async validateDestinationCredential(destination) {
      const credential = await this.resolveDestinationCredential(destination);
      if (!credential) {
        return { ok: false, reason: "credential_missing_or_invalid" };
      }
      if (!credential.username.trim() || !credential.applicationPassword.trim()) {
        return { ok: false, reason: "credential_fields_missing" };
      }
      return { ok: true };
    },

    invalidateDestinationCredentialCache(credentialReference) {
      if (!credentialReference) {
        cache.clear();
        return;
      }

      const referenceName = credentialReference.startsWith("env:")
        ? credentialReference.slice(4).trim()
        : credentialReference.trim();

      if (referenceName) cache.delete(referenceName);
    },
  };
}
