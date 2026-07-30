import { describe, expect, it } from "@jest/globals";
import {
  AuthorizationService,
  CapabilityResolver,
  DecisionCache,
  PermissionResolver,
  PolicyEngine,
  ResourceAuthorizer,
  RoleResolver,
  StaticAuthorizationProvider,
  WorkspaceResolver,
  type AuthorizationContext,
  type AuthorizationPolicy,
} from "@/platform/identity/authorization";

function createBaseContext(overrides?: Partial<AuthorizationContext>): AuthorizationContext {
  return {
    requestId: "request-1",
    principalId: "viewer@example.com",
    principalName: "Viewer",
    actionId: "job:retry",
    actionType: "job_action",
    workspaceId: "glw-led-display-warehouse",
    moduleId: "glw.core",
    roles: ["VIEWER"],
    memberships: [
      {
        workspaceId: "glw-led-display-warehouse",
        actorId: "viewer@example.com",
        role: "VIEWER",
        permissions: ["read"],
        active: true,
      },
    ],
    permissionSet: {
      directPermissions: ["read"],
      inheritedPermissions: [],
      capabilityPermissions: [],
      workspacePermissions: [],
      resourcePermissions: [],
    },
    capabilities: [],
    resource: {
      resourceType: "WORK_ORDER",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
    },
    contractVersion: "1.0.0",
    requestedAt: new Date().toISOString(),
    ...overrides,
  };
}

const policies: AuthorizationPolicy[] = [
  {
    policyId: "viewer-read-only",
    description: "Viewers can only view jobs.",
    effect: "ALLOW",
    priority: 100,
    active: true,
    roles: ["VIEWER"],
    actions: ["job:view"],
  },
  {
    policyId: "viewer-deny-mutation",
    description: "Viewers cannot mutate jobs.",
    effect: "DENY",
    priority: 200,
    active: true,
    roles: ["VIEWER"],
    actions: ["job:retry", "job:duplicate"],
  },
  {
    policyId: "admin-all-access",
    description: "Administrators can access all joined workspace surfaces.",
    effect: "ALLOW",
    priority: 300,
    active: true,
    roles: ["ADMINISTRATOR"],
  },
];

describe("identity authorization platform", () => {
  it("policy and regression: denies viewer mutation and preserves deny reason", () => {
    const service = new AuthorizationService(new StaticAuthorizationProvider(policies), { cacheTtlMs: 5_000 });

    const decision = service.authorize(createBaseContext());

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_POLICY");
    expect(decision.policyId).toBe("viewer-deny-mutation");
  });

  it("role and workspace: allows admin access in joined workspaces", () => {
    const service = new AuthorizationService(new StaticAuthorizationProvider(policies));

    const decision = service.authorize(createBaseContext({
      principalId: "admin@example.com",
      roles: ["ADMINISTRATOR"],
      actionId: "metrics:view",
      actionType: "metrics_access",
      memberships: [
        {
          workspaceId: "glw-led-display-warehouse",
          actorId: "admin@example.com",
          role: "ADMINISTRATOR",
          permissions: ["read", "write", "admin"],
          active: true,
        },
      ],
      permissionSet: {
        directPermissions: ["read", "write", "admin"],
        inheritedPermissions: [],
        capabilityPermissions: [],
        workspacePermissions: [],
        resourcePermissions: [],
      },
    }));

    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("ALLOWED");
    expect(decision.policyId).toBe("admin-all-access");
  });

  it("resource and negative boundary: denies viewer for unowned resource", () => {
    const service = new AuthorizationService(new StaticAuthorizationProvider(policies));

    const decision = service.authorize(createBaseContext({
      actionId: "job:view",
      resource: {
        resourceType: "WORK_ORDER",
        workspaceId: "glw-led-display-warehouse",
        moduleId: "glw.core",
        ownerActorId: "other@example.com",
      },
    }));

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_OWNERSHIP");
  });

  it("cache and metrics: records cache hit/miss and decision counts", () => {
    const service = new AuthorizationService(new StaticAuthorizationProvider(policies), { cacheTtlMs: 60_000 });
    const context = createBaseContext({ actionId: "job:view", actionType: "job_visibility" });

    const first = service.authorize(context);
    const second = service.authorize(context);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(second.cacheHit).toBe(true);

    const snapshot = service.getMetrics();
    expect(snapshot.evaluatedCount).toBe(2);
    expect(snapshot.cacheHitCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.cacheMissCount).toBeGreaterThanOrEqual(1);
  });

  it("health and resolver telemetry: exposes policy/cache/metrics checks", () => {
    const service = new AuthorizationService(new StaticAuthorizationProvider(policies));
    const context = createBaseContext({ actionId: "job:view", actionType: "job_visibility" });

    service.authorize(context);
    const health = service.healthSnapshot(context);

    expect(health.status).toBe("HEALTHY");
    expect(health.checks.some((check) => check.name === "policy" && check.status === "PASS")).toBe(true);
  });
});

describe("authorization resolver primitives", () => {
  it("capability and permission resolution derives hierarchical capabilities", () => {
    const roleResolver = new RoleResolver();
    const permissionResolver = new PermissionResolver();
    const capabilityResolver = new CapabilityResolver();

    const context = createBaseContext({
      roles: ["OPERATOR"],
      permissionSet: {
        directPermissions: ["gmp:content:approve_draft"],
        inheritedPermissions: [],
        capabilityPermissions: [],
        workspacePermissions: [],
        resourcePermissions: [],
      },
    });

    const roles = roleResolver.resolve(context);
    const permissions = permissionResolver.resolve(context, roles);
    const capabilities = capabilityResolver.resolve({ ...context, permissionSet: permissions });

    expect(roles.some((role) => role.roleId === "OPERATOR")).toBe(true);
    expect(permissions.inheritedPermissions.length).toBeGreaterThan(0);
    expect(capabilities.some((capability) => capability.capabilityId === "gmp")).toBe(true);
    expect(capabilities.some((capability) => capability.capabilityId === "gmp:content")).toBe(true);
  });

  it("workspace and resource authorizer denies missing workspace membership", () => {
    const workspaceResolver = new WorkspaceResolver();
    const resourceAuthorizer = new ResourceAuthorizer();

    const context = createBaseContext({ memberships: [] });
    const workspace = workspaceResolver.resolve(context);
    const resourceDecision = resourceAuthorizer.authorize(context, workspace);

    expect(resourceDecision.allowed).toBe(false);
    expect(resourceDecision.reasonCode).toBe("DENIED_WORKSPACE");
  });

  it("policy engine default deny path is deterministic", () => {
    const engine = new PolicyEngine();
    const decisionCache = new DecisionCache(60_000);
    const context = createBaseContext({ actionId: "unknown:action" });

    const decision = engine.evaluate({
      context,
      roles: [{ roleId: "VIEWER", scope: "SYSTEM", precedence: 10 }],
      capabilities: [],
      policies: [],
      cacheHit: decisionCache.get("missing") !== null,
      startedAtMs: Date.now(),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("DENIED_DEFAULT");
  });
});
