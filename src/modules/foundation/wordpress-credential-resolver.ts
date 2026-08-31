import "server-only";

import {
  resolveStoredWordPressCredential,
} from "./wordpress-credential-store";

export type ResolvedWordPressCredential = {
  username: string;
  applicationPassword: string;
};

function normalizePassword(value: string): string {
  return value.replace(/\s+/g, "");
}

function candidatePrefixes(
  reference: string,
): readonly string[] {
  const normalized = reference.trim();

  if (
    normalized ===
    "SSI_WORDPRESS_CREDENTIAL_REFERENCE"
  ) {
    return [
      "GENESIS_SSI_WORDPRESS",
      "SSI_WORDPRESS",
      normalized,
    ];
  }

  if (
    normalized ===
    "LED_COMPANY_CREDENTIAL_REFERENCE"
  ) {
    return [
      "GENESIS_GLW_WORDPRESS",
      "GLW_WORDPRESS",
      normalized,
    ];
  }

  return [normalized];
}

export function resolveWordPressCredentialReference(
  reference: string | null,
  environment: NodeJS.ProcessEnv = process.env,
): ResolvedWordPressCredential | null {
  if (!reference?.trim()) {
    return null;
  }

  const normalizedReference = reference.trim();

  if (normalizedReference.startsWith("credref-wp-")) {
    return resolveStoredWordPressCredential(
      normalizedReference,
    );
  }

  for (
    const prefix of candidatePrefixes(normalizedReference)
  ) {
    const username =
      environment[`${prefix}_USERNAME`]?.trim();

    const applicationPassword =
      environment[
        `${prefix}_APPLICATION_PASSWORD`
      ]?.trim();

    if (username && applicationPassword) {
      return {
        username,
        applicationPassword:
          normalizePassword(applicationPassword),
      };
    }
  }

  return null;
}