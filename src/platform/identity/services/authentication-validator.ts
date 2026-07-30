import type { AuthenticationRequest } from "../contracts";

export class AuthenticationValidator {
  validateRequest(request: AuthenticationRequest): { valid: boolean; reasonCode?: string; reasonMessage?: string } {
    if (!request.requestId) {
      return {
        valid: false,
        reasonCode: "CONTRACT_MISMATCH",
        reasonMessage: "requestId is required.",
      };
    }

    if (request.credential.kind !== "PASSWORD") {
      return {
        valid: false,
        reasonCode: "CONTRACT_MISMATCH",
        reasonMessage: "Only PASSWORD credentials are supported in GID-1002.",
      };
    }

    if (!request.credential.keyReference) {
      return {
        valid: false,
        reasonCode: "INVALID_CREDENTIAL",
        reasonMessage: "Credential keyReference is required.",
      };
    }

    return { valid: true };
  }
}
