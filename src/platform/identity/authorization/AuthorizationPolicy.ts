import type { AuthorizationContext } from "./AuthorizationContext";

export type AuthorizationPolicy = {
  policyId: string;
  description: string;
  effect: "ALLOW" | "DENY";
  priority: number;
  active: boolean;
  roles?: string[];
  permissions?: string[];
  workspaceIds?: string[];
  moduleIds?: string[];
  actions?: string[];
  jobTypes?: string[];
  jobStatuses?: string[];
  extensionIds?: string[];
  resourceTypes?: string[];
  capabilities?: string[];
};

export type AuthorizationProvider = {
  providerId: string;
  getPolicies(context: AuthorizationContext): AuthorizationPolicy[];
};
