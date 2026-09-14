import "server-only";

import type { NextRequest } from "next/server";
import { resolveAuthenticatedOperatorPrincipal } from "@/modules/foundation/operator-session";

export type GlwTrustedOperatorPrincipal = {
  principalId: string;
  sessionId: string;
  authority: string;
};

export type GlwTrustedPrincipalResolution =
  | { ok: true; principal: GlwTrustedOperatorPrincipal }
  | {
      ok: false;
      code: "TRUSTED_OPERATOR_SESSION_UNAVAILABLE";
      message: string;
    };

export function resolveGlwTrustedOperatorPrincipal(
  request: NextRequest,
): GlwTrustedPrincipalResolution {
  const resolution = resolveAuthenticatedOperatorPrincipal(request);
  if (!resolution.ok) {
    return {
      ok: false,
      code: "TRUSTED_OPERATOR_SESSION_UNAVAILABLE",
      message: "A valid server-verified Genesis operator session is required.",
    };
  }
  return {
    ok: true,
    principal: {
      principalId: resolution.principal.principalId,
      sessionId: resolution.principal.sessionId,
      authority: resolution.principal.authenticationAuthority,
    },
  };
}
