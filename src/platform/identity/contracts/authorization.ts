import type {
  DeterministicJsonObject,
  PermissionId,
  PolicyId,
  PrincipalId,
  RoleId,
  WorkspaceId,
} from "./primitives";

export const authorizationDecisionFieldOrder = [
  "decisionId",
  "allowed",
  "reasonCode",
  "principalId",
  "workspaceId",
  "resource",
  "action",
  "policyId",
  "grants",
  "denials",
  "evaluatedAt",
] as const;

export type RoleDescriptor = {
  roleId: RoleId;
  displayName: string;
  permissionIds: PermissionId[];
  workspaceScoped: boolean;
};

export type PermissionDescriptor = {
  permissionId: PermissionId;
  namespace: string;
  action: string;
  resource: string;
  description?: string;
};

export type PolicyDescriptor = {
  policyId: PolicyId;
  version: string;
  effect: "ALLOW" | "DENY";
  priority: number;
  conditions: DeterministicJsonObject;
  ownerType: "APPLICATION" | "PLATFORM" | "GOVERNANCE";
  ownerId: string;
  active: boolean;
};

export type GrantDescriptor = {
  grantId: string;
  principalId: PrincipalId;
  permissionId: PermissionId;
  workspaceId?: WorkspaceId;
  policyId?: PolicyId;
  grantedByPrincipalId?: PrincipalId;
  delegated: boolean;
};

export type DenialDescriptor = {
  denialId: string;
  principalId: PrincipalId;
  permissionId?: PermissionId;
  policyId?: PolicyId;
  reasonCode: string;
  reason: string;
};

export type AuthorizationRequest = {
  requestId: string;
  principalId: PrincipalId;
  workspaceId?: WorkspaceId;
  permissionId?: PermissionId;
  action: string;
  resource: DeterministicJsonObject;
  context?: DeterministicJsonObject;
};

export type AuthorizationDecision = {
  decisionId: string;
  allowed: boolean;
  reasonCode: string;
  principalId: PrincipalId;
  workspaceId?: WorkspaceId;
  resource: DeterministicJsonObject;
  action: string;
  policyId?: PolicyId;
  grants: GrantDescriptor[];
  denials: DenialDescriptor[];
  evaluatedAt: string;
};
