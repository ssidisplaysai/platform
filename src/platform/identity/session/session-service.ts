import { randomUUID } from "node:crypto";
import type { SessionDescriptor, SessionValidationResult } from "../contracts";
import type { SessionService as SessionServicePort } from "../ports";
import { GlwSessionCodec } from "./glw-session-codec";

export class GenesisSessionService implements SessionServicePort {
  constructor(private readonly codec: GlwSessionCodec) {}

  createSession(input: {
    principalId: string;
    identityId: string;
    workspaceId?: string;
    authenticationContextId: string;
  }): Promise<SessionDescriptor> {
    const issuedAt = new Date().toISOString();
    const descriptor: SessionDescriptor = {
      sessionId: randomUUID(),
      principalId: input.principalId,
      identityId: input.identityId,
      workspaceId: input.workspaceId,
      authenticationContextId: input.authenticationContextId,
      issuedAt,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
      active: true,
    };

    return Promise.resolve(descriptor);
  }

  validateSession(sessionReference: { sessionId?: string; token?: string }): Promise<SessionValidationResult> {
    if (!sessionReference.token) {
      return Promise.resolve({
        sessionId: sessionReference.sessionId,
        valid: false,
        reasonCode: "INVALID_SESSION",
      });
    }

    return Promise.resolve(this.codec.validate(sessionReference.token));
  }

  revokeSession(sessionId: string, reasonCode: string): Promise<void> {
    void sessionId;
    void reasonCode;
    return Promise.resolve();
  }

  issueToken(email: string) {
    return this.codec.create(email);
  }

  readToken(token: string) {
    return this.codec.decode(token);
  }

  renewToken(token: string) {
    return this.codec.renew(token);
  }

  revokeToken(token: string) {
    this.codec.revoke(token);
  }
}
