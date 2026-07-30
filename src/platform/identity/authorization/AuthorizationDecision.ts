export type DecisionResult = "ALLOW" | "DENY";

export type AuthorizationDecision = {
  decisionId: string;
  result: DecisionResult;
  allowed: boolean;
  reasonCode:
    | "ALLOWED"
    | "DENIED_ROLE"
    | "DENIED_WORKSPACE"
    | "DENIED_MODULE"
    | "DENIED_ACTION"
    | "DENIED_ROUTE"
    | "DENIED_STATE"
    | "DENIED_EXTENSION"
    | "DENIED_OWNERSHIP"
    | "DENIED_POLICY"
    | "DENIED_DEFAULT";
  reason: string;
  policyId: string;
  principalId: string;
  actionId: string;
  workspaceId?: string;
  resourceType: string;
  grants: string[];
  denials: string[];
  cacheHit: boolean;
  evaluatedAt: string;
  latencyMs: number;
};
