import { randomUUID } from "node:crypto";
import type { SessionDescriptor, SessionValidationResult } from "../contracts";
import type { SessionService as SessionServicePort } from "../ports";
import { trackSessionRevoked } from "../telemetry/authentication-metrics";
import type { SessionRecordStore } from "../persistence";
import { getDefaultSessionRecordStore } from "../persistence";
import { GlwSessionCodec } from "./glw-session-codec";

export class GenesisSessionService implements SessionServicePort {
  constructor(
    private readonly codec: GlwSessionCodec,
    private readonly store: SessionRecordStore = getDefaultSessionRecordStore(),
  ) {}

  async createSession(input: {
    principalId: string;
    identityId: string;
    workspaceId?: string;
    authenticationContextId: string;
  }): Promise<SessionDescriptor> {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.codec.getTtlSeconds() * 1000).toISOString();
    const sessionId = randomUUID();
    const descriptor: SessionDescriptor = {
      sessionId,
      principalId: input.principalId,
      identityId: input.identityId,
      workspaceId: input.workspaceId,
      authenticationContextId: input.authenticationContextId,
      issuedAt,
      expiresAt,
      active: true,
    };

    const token = this.codec.encode({
      email: input.principalId,
      expiresAt: new Date(expiresAt).getTime(),
    });

    await this.store.saveIssuedSession({
      sessionId,
      tokenHash: this.codec.tokenHash(token),
      principalId: input.principalId,
      identityId: input.identityId,
      authenticationContextId: input.authenticationContextId,
      issuedAt,
      expiresAt,
    });

    return descriptor;
  }

  async validateSession(sessionReference: { sessionId?: string; token?: string }): Promise<SessionValidationResult> {
    if (!sessionReference.token) {
      if (sessionReference.sessionId) {
        const recordBySessionId = await this.store.findBySessionId(sessionReference.sessionId);
        if (recordBySessionId && !recordBySessionId.revokedAt && new Date(recordBySessionId.expiresAt).getTime() > Date.now()) {
          return {
            sessionId: recordBySessionId.sessionId,
            valid: true,
            principalId: recordBySessionId.principalId,
            identityId: recordBySessionId.identityId,
            expiresAt: recordBySessionId.expiresAt,
          };
        }
      }

      return {
        sessionId: sessionReference.sessionId,
        valid: false,
        reasonCode: "INVALID_SESSION",
      };
    }

    const inspected = this.codec.decodeWithStatus(sessionReference.token);
    if (!inspected.payload) {
      return {
        valid: false,
        reasonCode: inspected.reasonCode ?? "INVALID_SESSION",
      };
    }

    const tokenHash = this.codec.tokenHash(sessionReference.token);
    const record = await this.store.findByTokenHash(tokenHash);

    if (record?.revokedAt) {
      return {
        valid: false,
        reasonCode: "REVOKED_SESSION",
      };
    }

    if (!record) {
      const recoveredSessionId = `recovered-${tokenHash.slice(0, 24)}`;
      await this.store.saveIssuedSession({
        sessionId: recoveredSessionId,
        tokenHash,
        principalId: inspected.payload.email,
        identityId: inspected.payload.email,
        authenticationContextId: recoveredSessionId,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(inspected.payload.expiresAt).toISOString(),
      });
    }

    return {
      sessionId: record?.sessionId,
      valid: true,
      principalId: inspected.payload.email,
      identityId: inspected.payload.email,
      expiresAt: new Date(inspected.payload.expiresAt).toISOString(),
    };
  }

  async revokeSession(sessionId: string, reasonCode: string): Promise<void> {
    const revoked = await this.store.revokeBySessionId({
      sessionId,
      reasonCode,
    });

    if (revoked) {
      trackSessionRevoked();
    }
  }

  async issueToken(email: string) {
    const issued = this.codec.create(email);
    await this.store.saveIssuedSession({
      sessionId: issued.descriptor.sessionId,
      tokenHash: this.codec.tokenHash(issued.token),
      principalId: issued.descriptor.principalId,
      identityId: issued.descriptor.identityId,
      authenticationContextId: issued.descriptor.authenticationContextId,
      issuedAt: issued.descriptor.issuedAt,
      expiresAt: issued.descriptor.expiresAt,
    });

    return issued;
  }

  async readToken(token: string) {
    const validation = await this.validateSession({ token });
    if (!validation.valid) {
      return null;
    }

    return this.codec.decode(token);
  }

  async renewToken(token: string) {
    const renewed = this.codec.renew(token);
    if (!renewed) {
      return null;
    }

    const rotated = await this.store.rotateSession({
      oldTokenHash: this.codec.tokenHash(token),
      replacement: {
        sessionId: renewed.descriptor.sessionId,
        tokenHash: this.codec.tokenHash(renewed.token),
        principalId: renewed.descriptor.principalId,
        identityId: renewed.descriptor.identityId,
        authenticationContextId: renewed.descriptor.authenticationContextId,
        issuedAt: renewed.descriptor.issuedAt,
        expiresAt: renewed.descriptor.expiresAt,
      },
      reasonCode: "SESSION_RENEWED",
      actorPrincipalId: renewed.descriptor.principalId,
    });

    if (rotated) {
      trackSessionRevoked();
    }

    this.codec.revoke(token);

    return renewed;
  }

  async revokeToken(token: string, reasonCode = "SESSION_REVOKED", actorPrincipalId?: string) {
    const revoked = await this.store.revokeByTokenHash({
      tokenHash: this.codec.tokenHash(token),
      reasonCode,
      actorPrincipalId,
    });

    if (revoked) {
      this.codec.revoke(token);
    }

    return revoked;
  }

  countActiveSessions(referenceTime = new Date().toISOString()): Promise<number> {
    return this.store.countActiveSessions(referenceTime);
  }
}
