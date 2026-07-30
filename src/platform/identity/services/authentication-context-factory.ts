import { randomUUID } from "node:crypto";
import type { AuthenticationContext } from "../contracts";

export class AuthenticationContextFactory {
  create(input: {
    principalId: string;
    identityId: string;
    providerId: string;
    method: AuthenticationContext["method"];
  }): AuthenticationContext {
    return {
      authenticationContextId: randomUUID(),
      principalId: input.principalId,
      identityId: input.identityId,
      providerId: input.providerId,
      assuranceLevel: "LOW",
      method: input.method,
      authenticatedAt: new Date().toISOString(),
      metadata: {
        contractVersion: "1.0.0",
      },
    };
  }
}
