import { randomUUID } from "node:crypto";
import type { IdentityAuditRecord } from "../contracts";
import type { IdentityAuditSink } from "../ports";
import {
  type IdentityAuditStore,
  getDefaultAuthenticationAuditStore,
} from "../persistence";

export type AuthenticationAuditEvent = {
  eventType: IdentityAuditRecord["eventType"];
  outcome: IdentityAuditRecord["outcome"];
  principalId?: string;
  details: IdentityAuditRecord["details"];
};

const defaultAuditStore = getDefaultAuthenticationAuditStore();

export async function getIdentityAuditRecords(limit = 200): Promise<IdentityAuditRecord[]> {
  return defaultAuditStore.listRecent(limit);
}

export class AuthenticationAuditWriter {
  constructor(private readonly auditSink: IdentityAuditSink = defaultAuditStore) {}

  async write(event: AuthenticationAuditEvent): Promise<void> {
    try {
      await this.auditSink.publish({
        auditId: randomUUID(),
        eventType: event.eventType,
        occurredAt: new Date().toISOString(),
        principalId: event.principalId,
        outcome: event.outcome,
        details: event.details,
      });
    } catch {
      // Preserve authentication runtime behavior if audit persistence is temporarily unavailable.
    }
  }

  async listRecent(limit = 200): Promise<IdentityAuditRecord[]> {
    if ("listRecent" in this.auditSink) {
      return (this.auditSink as IdentityAuditStore).listRecent(limit);
    }

    return [];
  }

  async loginSuccess(principalId: string, providerId: string): Promise<void> {
    await this.write({
      eventType: "AUTHENTICATION_SUCCEEDED",
      outcome: "SUCCESS",
      principalId,
      details: { category: "login", providerId },
    });
  }

  async loginFailure(providerId: string, reasonCode: string): Promise<void> {
    await this.write({
      eventType: "AUTHENTICATION_FAILED",
      outcome: "DENY",
      details: { category: "login", providerId, reasonCode },
    });
  }

  async credentialRejected(providerId: string): Promise<void> {
    await this.write({
      eventType: "AUTHENTICATION_FAILED",
      outcome: "DENY",
      details: { category: "credential_rejected", providerId, reasonCode: "INVALID_CREDENTIAL" },
    });
  }

  async providerUnavailable(providerId: string): Promise<void> {
    await this.write({
      eventType: "AUTHENTICATION_FAILED",
      outcome: "ERROR",
      details: { category: "provider_unavailable", providerId, reasonCode: "PROVIDER_UNAVAILABLE" },
    });
  }

  async authenticationError(providerId: string, reasonCode: string): Promise<void> {
    await this.write({
      eventType: "AUTHENTICATION_FAILED",
      outcome: "ERROR",
      details: { category: "authentication_error", providerId, reasonCode },
    });
  }

  async sessionCreated(principalId: string): Promise<void> {
    await this.write({
      eventType: "SESSION_CREATED",
      outcome: "SUCCESS",
      principalId,
      details: { category: "session_created" },
    });
  }

  async sessionExpired(principalId: string): Promise<void> {
    await this.write({
      eventType: "SESSION_REVOKED",
      outcome: "SUCCESS",
      principalId,
      details: { category: "session_expired" },
    });
  }

  async sessionRevoked(principalId: string): Promise<void> {
    await this.write({
      eventType: "SESSION_REVOKED",
      outcome: "SUCCESS",
      principalId,
      details: { category: "session_revoked" },
    });
  }

  async logout(principalId: string): Promise<void> {
    await this.write({
      eventType: "SESSION_REVOKED",
      outcome: "SUCCESS",
      principalId,
      details: { category: "logout" },
    });
  }
}
