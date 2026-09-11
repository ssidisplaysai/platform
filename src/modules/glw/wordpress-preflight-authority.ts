import "server-only";

import {
  createAuthenticatedWordPressReadAuthority,
  type AuthenticatedWordPressReadAuthority,
} from "@/modules/foundation/authenticated-wordpress-read-authority";
import { resolveWordPressCredentialForSite } from "@/modules/foundation/wordpress-credential-resolver";

export type GlwWordPressPreflightAuthorityResult = {
  authority: AuthenticatedWordPressReadAuthority | null;
  status: "READY" | "NOT_CONFIGURED" | "CREDENTIAL_UNAVAILABLE" | "CREDENTIAL_DECRYPTION_FAILED";
};

export function createGlwWordPressPreflightAuthority(input: {
  organizationId: string;
  siteId: string;
  wordpressApiBaseUrl: string | null;
  wordpressCredentialReference: string | null;
}): GlwWordPressPreflightAuthorityResult {
  const apiBaseUrl = input.wordpressApiBaseUrl?.trim();
  const reference = input.wordpressCredentialReference?.trim();
  if (!apiBaseUrl || !reference) return { authority: null, status: "NOT_CONFIGURED" };
  try {
    const credential = resolveWordPressCredentialForSite({
      reference,
      organizationId: input.organizationId,
      siteId: input.siteId,
    });
    if (!credential) return { authority: null, status: "CREDENTIAL_UNAVAILABLE" };
    return {
      authority: createAuthenticatedWordPressReadAuthority({
        configuration: {
          apiBaseUrl,
          username: credential.username,
          applicationPassword: credential.applicationPassword,
          timeoutMs: 30_000,
        },
      }),
      status: "READY",
    };
  } catch {
    return { authority: null, status: "CREDENTIAL_DECRYPTION_FAILED" };
  }
}