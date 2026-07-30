import type {
  AuthenticationRequest,
  AuthenticationResult,
  AuthorizationDecision,
  AuthorizationRequest,
  CredentialReference,
  IdentityAuditRecord,
  IdentityContractVersion,
  IdentityProviderReference,
  IdentitySubject,
  MembershipDescriptor,
  PolicyDescriptor,
  Principal,
  SessionDescriptor,
  SessionValidationResult,
  WorkspaceId,
} from "../contracts";

export type IdentityResolver = {
  resolvePrincipalById(principalId: string): Promise<Principal | null>;
  resolveSubjectByPrincipalId(principalId: string): Promise<IdentitySubject | null>;
};

export type AuthenticationService = {
  authenticate(request: AuthenticationRequest): Promise<AuthenticationResult>;
};

export type SessionService = {
  createSession(input: {
    principalId: string;
    identityId: string;
    workspaceId?: WorkspaceId;
    authenticationContextId: string;
  }): Promise<SessionDescriptor>;
  validateSession(sessionReference: { sessionId?: string; token?: string }): Promise<SessionValidationResult>;
  revokeSession(sessionId: string, reasonCode: string): Promise<void>;
};

export type AuthorizationService = {
  authorize(request: AuthorizationRequest): Promise<AuthorizationDecision>;
};

export type PolicyResolver = {
  resolvePolicies(input: {
    principalId: string;
    workspaceId?: WorkspaceId;
    contractVersion: IdentityContractVersion;
  }): Promise<PolicyDescriptor[]>;
};

export type MembershipResolver = {
  resolveMemberships(principalId: string, workspaceId?: WorkspaceId): Promise<MembershipDescriptor[]>;
};

export type CredentialVerifier = {
  verify(credential: CredentialReference): Promise<{ valid: boolean; reasonCode?: string }>;
};

export type IdentityProviderAdapter = {
  provider(): IdentityProviderReference;
  authenticate(request: AuthenticationRequest): Promise<AuthenticationResult>;
  validateSession(sessionReference: { sessionId?: string; token?: string }): Promise<SessionValidationResult>;
};

export type IdentityAuditSink = {
  publish(record: IdentityAuditRecord): Promise<void>;
};

export type IdentityHealthContributor = {
  healthSnapshot(): Promise<{
    status: "HEALTHY" | "DEGRADED" | "CRITICAL";
    checks: Array<{ name: string; status: "PASS" | "WARN" | "FAIL"; detail?: string }>;
    generatedAt: string;
  }>;
};
