export type Role = {
  roleId: string;
  scope: "SYSTEM" | "WORKSPACE";
  precedence: number;
};

export type Permission = {
  permissionId: string;
  scope: "GLOBAL" | "WORKSPACE" | "RESOURCE";
};

export type Capability = {
  capabilityId: string;
  permissionIds: string[];
};

export type WorkspaceMembership = {
  workspaceId: string;
  actorId: string;
  role: string;
  permissions: string[];
  active: boolean;
  inheritedFromWorkspaceId?: string;
};

export type ResourceDescriptor = {
  resourceType:
    | "PAGE"
    | "ACTION"
    | "SERVICE"
    | "OBJECT"
    | "OPERATION"
    | "WORK_ORDER"
    | "ARTIFACT"
    | "GENERIC";
  resourceId?: string;
  ownerActorId?: string;
  workspaceId?: string;
  moduleId?: string;
  extensionId?: string;
  route?: string;
  metadata?: Record<string, unknown>;
};

export type PermissionSet = {
  directPermissions: string[];
  inheritedPermissions: string[];
  capabilityPermissions: string[];
  workspacePermissions: string[];
  resourcePermissions: string[];
};

export type AuthorizationContext = {
  requestId: string;
  principalId: string;
  principalName?: string;
  actionId: string;
  actionType:
    | "module_visibility"
    | "route_access"
    | "job_visibility"
    | "job_action"
    | "inspector_extension"
    | "metrics_access"
    | "admin_control"
    | "notification_access"
    | "workspace_access"
    | "resource_access";
  workspaceId?: string;
  moduleId?: string;
  jobType?: string;
  jobStatus?: string;
  roles: string[];
  memberships: WorkspaceMembership[];
  permissionSet: PermissionSet;
  capabilities: string[];
  resource: ResourceDescriptor;
  contractVersion: "1.0.0";
  requestedAt: string;
  context?: Record<string, unknown>;
};
