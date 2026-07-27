import { createHash } from "node:crypto";
import type { GmpAnalyticsSource } from "./analytics-models";

const secretKeyPatterns = [
  "token",
  "password",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "refresh_token",
  "client_secret",
  "private_key",
  "service_account",
  "bearer",
];

export type GmpResolvedAnalyticsCredential = {
  reference: string;
  resolvedAt: string;
  secretValue: string;
  fingerprint: string;
};

export type GmpAnalyticsCredentialProvider = {
  resolveSourceCredential: (source: GmpAnalyticsSource) => Promise<GmpResolvedAnalyticsCredential | null>;
  validateSourceCredential: (source: GmpAnalyticsSource) => Promise<{ ok: boolean; reason?: string }>;
  redactDiagnostic: (value: unknown) => string;
};

function normalizeReference(reference: string): string {
  const trimmed = reference.trim();
  return trimmed.startsWith("env:") ? trimmed.slice(4).trim() : trimmed;
}

function hasSecretLikeValue(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    const lowered = key.toLowerCase();
    if (secretKeyPatterns.some((entry) => lowered.includes(entry))) {
      return true;
    }
  }

  return false;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
      const lowered = key.toLowerCase();
      output[key] = secretKeyPatterns.some((entry) => lowered.includes(entry)) ? "[REDACTED]" : redact(fieldValue);
    }
    return output;
  }

  return value;
}

export function createEnvironmentAnalyticsCredentialProvider(): GmpAnalyticsCredentialProvider {
  return {
    async resolveSourceCredential(source) {
      const credentialReference = source.credentialsReference?.trim();
      if (!credentialReference) {
        return null;
      }

      const referenceName = normalizeReference(credentialReference);
      if (!referenceName) {
        return null;
      }

      const secretValue = process.env[referenceName];
      if (!secretValue || !secretValue.trim()) {
        return null;
      }

      return {
        reference: `env:${referenceName}`,
        resolvedAt: new Date().toISOString(),
        secretValue,
        fingerprint: createHash("sha256").update(`${referenceName}:${secretValue}`).digest("hex"),
      };
    },

    async validateSourceCredential(source) {
      const credentialReference = source.credentialsReference?.trim();
      if (!credentialReference) {
        return { ok: false, reason: "credential_reference_missing" };
      }

      const referenceName = normalizeReference(credentialReference);
      if (!referenceName) {
        return { ok: false, reason: "credential_reference_invalid" };
      }

      const secretValue = process.env[referenceName];
      if (!secretValue || !secretValue.trim()) {
        return { ok: false, reason: "credential_reference_unresolved" };
      }

      if (hasSecretLikeValue(source.configuration)) {
        return { ok: false, reason: "source_configuration_contains_secret_like_fields" };
      }

      return { ok: true };
    },

    redactDiagnostic(value) {
      return JSON.stringify(redact(value));
    },
  };
}
