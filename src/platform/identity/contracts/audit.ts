import type { DeterministicJsonObject, IsoTimestamp, PrincipalId, WorkspaceId } from "./primitives";

export type IdentityAuditRecord = {
  auditId: string;
  eventType:
    | "IDENTITY_CREATED"
    | "IDENTITY_UPDATED"
    | "IDENTITY_DISABLED"
    | "AUTHENTICATION_SUCCEEDED"
    | "AUTHENTICATION_FAILED"
    | "SESSION_CREATED"
    | "SESSION_REVOKED"
    | "AUTHORIZATION_EVALUATED"
    | "POLICY_UPDATED"
    | "MEMBERSHIP_CHANGED"
    | "FEDERATION_LINKED"
    | "FEDERATION_UNLINKED";
  principalId?: PrincipalId;
  workspaceId?: WorkspaceId;
  occurredAt: IsoTimestamp;
  actorPrincipalId?: PrincipalId;
  correlationId?: string;
  causationId?: string;
  outcome: "SUCCESS" | "DENY" | "ERROR";
  details: DeterministicJsonObject;
};
