import "server-only";

import type { NextRequest } from "next/server";

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
  void request;
  return {
    ok: false,
    code: "TRUSTED_OPERATOR_SESSION_UNAVAILABLE",
    message: "A server-verified Genesis operator session provider is required. Caller-supplied role and scope headers are not principal authority.",
  };
}