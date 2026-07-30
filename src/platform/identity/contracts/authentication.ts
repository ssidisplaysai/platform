import type {
  CredentialId,
  DeterministicJsonObject,
  IdentityId,
  IsoTimestamp,
  PrincipalId,
  ProviderId,
  SessionId,
  WorkspaceId,
} from "./primitives";

export type CredentialKind = "PASSWORD" | "TOKEN" | "CERTIFICATE" | "API_KEY" | "OPAQUE";

export type CredentialReference = {
  credentialId: CredentialId;
  principalId?: PrincipalId;
  providerId?: ProviderId;
  kind: CredentialKind;
  keyReference?: string;
  issuedAt?: IsoTimestamp;
  expiresAt?: IsoTimestamp;
  revokedAt?: IsoTimestamp;
};

export type SessionDescriptor = {
  sessionId: SessionId;
  principalId: PrincipalId;
  identityId: IdentityId;
  workspaceId?: WorkspaceId;
  authenticationContextId: string;
  issuedAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
  revokedAt?: IsoTimestamp;
  active: boolean;
};

export type AuthenticationContext = {
  authenticationContextId: string;
  principalId?: PrincipalId;
  identityId?: IdentityId;
  providerId?: ProviderId;
  assuranceLevel: "LOW" | "MEDIUM" | "HIGH";
  method: "PASSWORD" | "TOKEN" | "CERTIFICATE" | "FEDERATED" | "SESSION";
  authenticatedAt: IsoTimestamp;
  metadata?: DeterministicJsonObject;
};

export type AuthenticationRequest = {
  requestId: string;
  providerId?: ProviderId;
  workspaceId?: WorkspaceId;
  credential: CredentialReference;
  context?: DeterministicJsonObject;
};

export type AuthenticationResult = {
  requestId: string;
  authenticated: boolean;
  principalId?: PrincipalId;
  identityId?: IdentityId;
  session?: SessionDescriptor;
  authenticationContext?: AuthenticationContext;
  failureCode?: string;
  failureMessage?: string;
};

export type SessionValidationResult = {
  sessionId?: SessionId;
  valid: boolean;
  principalId?: PrincipalId;
  identityId?: IdentityId;
  expiresAt?: IsoTimestamp;
  reasonCode?: string;
};
