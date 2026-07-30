import type {
  DeterministicJsonObject,
  FederationLinkId,
  IdentityId,
  IsoTimestamp,
  LifecycleState,
  OrganizationId,
  PrincipalId,
  ProviderId,
  WorkspaceId,
} from "./primitives";

export type IdentityKind = "HUMAN" | "SERVICE" | "AGENT" | "APPLICATION";

export type Principal = {
  principalId: PrincipalId;
  identityId: IdentityId;
  kind: IdentityKind;
  displayName?: string;
  organizationId?: OrganizationId;
  workspaceIds: WorkspaceId[];
  lifecycleState: LifecycleState;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type IdentitySubject = {
  subjectId: IdentityId;
  principalId: PrincipalId;
  kind: IdentityKind;
  email?: string;
  applicationKey?: string;
  serviceKey?: string;
  agentKey?: string;
  externalProviderId?: ProviderId;
  externalSubjectId?: string;
  lifecycleState: LifecycleState;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  metadata?: DeterministicJsonObject;
};

export type HumanIdentity = {
  identityId: IdentityId;
  principalId: PrincipalId;
  email: string;
  givenName?: string;
  familyName?: string;
  locale?: string;
  timezone?: string;
  lifecycleState: LifecycleState;
};

export type ServiceIdentity = {
  identityId: IdentityId;
  principalId: PrincipalId;
  serviceName: string;
  serviceTier?: string;
  lifecycleState: LifecycleState;
};

export type AgentIdentity = {
  identityId: IdentityId;
  principalId: PrincipalId;
  agentName: string;
  lifecycleState: LifecycleState;
};

export type ApplicationIdentity = {
  identityId: IdentityId;
  principalId: PrincipalId;
  applicationId: string;
  lifecycleState: LifecycleState;
};

export type OrganizationDescriptor = {
  organizationId: OrganizationId;
  name: string;
  legalName?: string;
  lifecycleState: LifecycleState;
};

export type WorkspaceDescriptor = {
  workspaceId: WorkspaceId;
  organizationId: OrganizationId;
  key: string;
  displayName: string;
  lifecycleState: LifecycleState;
};

export type MembershipDescriptor = {
  membershipId: string;
  principalId: PrincipalId;
  workspaceId: WorkspaceId;
  roleIds: string[];
  permissionIds: string[];
  delegatedByPrincipalId?: PrincipalId;
  expiresAt?: IsoTimestamp;
  active: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
};

export type IdentityProviderReference = {
  providerId: ProviderId;
  providerType: "INTERNAL" | "EXTERNAL";
  displayName: string;
  enabled: boolean;
};

export type FederationReference = {
  federationLinkId: FederationLinkId;
  providerId: ProviderId;
  principalId: PrincipalId;
  externalSubjectId: string;
  linkedAt: IsoTimestamp;
  active: boolean;
};
