import "server-only";

import { resolveStoredWordPressCredentialForSite } from "./wordpress-credential-store";

export type ResolvedWordPressCredential = {
  username: string;
  applicationPassword: string;
};

function normalizePassword(value: string): string {
  return value.replace(/\s+/g, "");
}

function candidatePrefixes(reference: string): readonly string[] {
  if (reference === "SSI_WORDPRESS_CREDENTIAL_REFERENCE") {
    return ["GENESIS_SSI_WORDPRESS", "SSI_WORDPRESS", reference];
  }
  if (reference === "LED_COMPANY_CREDENTIAL_REFERENCE") {
    return ["GENESIS_GLW_WORDPRESS", "GLW_WORDPRESS", reference];
  }
  return [reference];
}

export function resolveWordPressCredentialForSite(input: {
  reference: string | null;
  organizationId: string;
  siteId: string;
  environment?: NodeJS.ProcessEnv;
}): ResolvedWordPressCredential | null {
  const reference = input.reference?.trim();
  if (!reference) return null;
  if (reference.startsWith("credref-wp-")) {
    return resolveStoredWordPressCredentialForSite({
      reference,
      organizationId: input.organizationId,
      siteId: input.siteId,
    });
  }
  const environment = input.environment ?? process.env;
  for (const prefix of candidatePrefixes(reference)) {
    const username = environment[`${prefix}_USERNAME`]?.trim();
    const applicationPassword = environment[`${prefix}_APPLICATION_PASSWORD`]?.trim();
    if (username && applicationPassword) {
      return { username, applicationPassword: normalizePassword(applicationPassword) };
    }
  }
  return null;
}