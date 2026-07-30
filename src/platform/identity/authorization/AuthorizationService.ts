import { randomUUID } from "node:crypto";
import type { AuthorizationContext } from "./AuthorizationContext";
import type { AuthorizationDecision } from "./AuthorizationDecision";
import type { AuthorizationPolicy, AuthorizationProvider } from "./AuthorizationPolicy";
import { DecisionCache } from "./DecisionCache";
import { PolicyEngine } from "./PolicyEngine";
import { RoleResolver } from "./RoleResolver";
import { PermissionResolver } from "./PermissionResolver";
import { CapabilityResolver } from "./CapabilityResolver";
import { WorkspaceResolver } from "./WorkspaceResolver";
import { ResourceAuthorizer } from "./ResourceAuthorizer";
import { AuthorizationAuditWriter } from "./AuthorizationAuditWriter";
import { AuthorizationMetrics } from "./AuthorizationMetrics";
import { AuthorizationHealth } from "./AuthorizationHealth";

function nowIso(): string {
  return new Date().toISOString();
}

export class StaticAuthorizationProvider implements AuthorizationProvider {
  readonly providerId = "genesis-static-policy-provider";

  constructor(private readonly policies: AuthorizationPolicy[]) {}

  getPolicies(_context: AuthorizationContext): AuthorizationPolicy[] {
    void _context;
    return [...this.policies];
  }
}

export class AuthorizationService {
  private readonly cache: DecisionCache;
  private readonly policyEngine: PolicyEngine;
  private readonly roleResolver: RoleResolver;
  private readonly permissionResolver: PermissionResolver;
  private readonly capabilityResolver: CapabilityResolver;
  private readonly workspaceResolver: WorkspaceResolver;
  private readonly resourceAuthorizer: ResourceAuthorizer;
  private readonly auditWriter: AuthorizationAuditWriter;
  private readonly metrics: AuthorizationMetrics;
  private readonly health: AuthorizationHealth;

  constructor(
    private readonly provider: AuthorizationProvider,
    options?: {
      cacheTtlMs?: number;
      cache?: DecisionCache;
      policyEngine?: PolicyEngine;
      roleResolver?: RoleResolver;
      permissionResolver?: PermissionResolver;
      capabilityResolver?: CapabilityResolver;
      workspaceResolver?: WorkspaceResolver;
      resourceAuthorizer?: ResourceAuthorizer;
      auditWriter?: AuthorizationAuditWriter;
      metrics?: AuthorizationMetrics;
      health?: AuthorizationHealth;
    },
  ) {
    this.cache = options?.cache ?? new DecisionCache(options?.cacheTtlMs ?? 60_000);
    this.policyEngine = options?.policyEngine ?? new PolicyEngine();
    this.roleResolver = options?.roleResolver ?? new RoleResolver();
    this.permissionResolver = options?.permissionResolver ?? new PermissionResolver();
    this.capabilityResolver = options?.capabilityResolver ?? new CapabilityResolver();
    this.workspaceResolver = options?.workspaceResolver ?? new WorkspaceResolver();
    this.resourceAuthorizer = options?.resourceAuthorizer ?? new ResourceAuthorizer();
    this.auditWriter = options?.auditWriter ?? new AuthorizationAuditWriter();
    this.metrics = options?.metrics ?? new AuthorizationMetrics();
    this.health = options?.health ?? new AuthorizationHealth();
  }

  invalidateDecisionCache(): void {
    this.cache.invalidate();
  }

  authorize(context: AuthorizationContext): AuthorizationDecision {
    const startedAtMs = Date.now();
    const key = this.cache.keyFor(context);
    const cached = this.cache.get(key);

    if (cached) {
      const decision = {
        ...cached,
        decisionId: `${context.requestId}:${cached.policyId}:cache`,
        cacheHit: true,
        evaluatedAt: nowIso(),
      };

      this.metrics.trackDecision(decision);
      void this.auditDecision(context, decision);
      return decision;
    }

    const roles = this.roleResolver.resolve(context);
    this.metrics.trackResolver("roleResolutions");

    const permissionSet = this.permissionResolver.resolve(context, roles);
    this.metrics.trackResolver("permissionResolutions");

    const normalizedContext: AuthorizationContext = {
      ...context,
      permissionSet,
    };

    const capabilities = this.capabilityResolver.resolve(normalizedContext);
    this.metrics.trackResolver("capabilityResolutions");

    const workspaceAccess = this.workspaceResolver.resolve(normalizedContext);
    this.metrics.trackResolver("workspaceResolutions");

    const resourceCheck = this.resourceAuthorizer.authorize(normalizedContext, workspaceAccess);
    this.metrics.trackResolver("resourceAuthorizations");

    let decision: AuthorizationDecision;

    if (!resourceCheck.allowed) {
      decision = {
        decisionId: randomUUID(),
        result: "DENY",
        allowed: false,
        reasonCode: resourceCheck.reasonCode ?? "DENIED_DEFAULT",
        reason: resourceCheck.reason ?? "Resource authorization failed.",
        policyId: resourceCheck.reasonCode === "DENIED_WORKSPACE" ? "workspace-membership" : "ownership-guard",
        principalId: normalizedContext.principalId,
        actionId: normalizedContext.actionId,
        workspaceId: normalizedContext.workspaceId,
        resourceType: normalizedContext.resource.resourceType,
        grants: [],
        denials: [resourceCheck.reasonCode ?? "DENIED_DEFAULT"],
        cacheHit: false,
        evaluatedAt: nowIso(),
        latencyMs: Date.now() - startedAtMs,
      };
    } else {
      const policies = this.provider.getPolicies(normalizedContext);
      decision = this.policyEngine.evaluate({
        context: normalizedContext,
        roles,
        capabilities,
        policies,
        cacheHit: false,
        startedAtMs,
      });
    }

    this.cache.set(key, decision);
    this.metrics.trackDecision(decision);
    void this.auditDecision(normalizedContext, decision);

    return decision;
  }

  getMetrics() {
    return this.metrics.snapshot();
  }

  getPolicyCount(context: AuthorizationContext): number {
    const policies = this.provider.getPolicies(context);
    return policies.length;
  }

  healthSnapshot(context?: AuthorizationContext) {
    const policyCount = context ? this.getPolicyCount(context) : 0;
    return this.health.snapshot({
      policyCount,
      cacheStats: this.cache.stats(),
      metrics: this.metrics,
    });
  }

  private async auditDecision(context: AuthorizationContext, decision: AuthorizationDecision): Promise<void> {
    await this.auditWriter.write({
      eventType: "AUTHORIZATION_EVALUATED",
      principalId: context.principalId,
      workspaceId: context.workspaceId,
      outcome: decision.allowed ? "SUCCESS" : "DENY",
      details: {
        decisionId: decision.decisionId,
        reasonCode: decision.reasonCode,
        policyId: decision.policyId,
        actionId: context.actionId,
        moduleId: context.moduleId,
        resourceType: context.resource.resourceType,
        cacheHit: decision.cacheHit,
      },
    });
  }
}
