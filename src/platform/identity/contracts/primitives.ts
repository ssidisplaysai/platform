export type IdentityId = string;
export type PrincipalId = string;
export type WorkspaceId = string;
export type OrganizationId = string;
export type SessionId = string;
export type CredentialId = string;
export type RoleId = string;
export type PermissionId = string;
export type PolicyId = string;
export type ProviderId = string;
export type FederationLinkId = string;

export type IsoTimestamp = string;

export type DeterministicScalar = string | number | boolean | null;

export type DeterministicJsonValue =
  | DeterministicScalar
  | readonly DeterministicJsonValue[]
  | { readonly [key: string]: DeterministicJsonValue };

export type DeterministicJsonObject = {
  readonly [key: string]: DeterministicJsonValue;
};

export type LifecycleState =
  | "PROVISIONING"
  | "ACTIVE"
  | "SUSPENDED"
  | "REVOKED"
  | "ARCHIVED";
