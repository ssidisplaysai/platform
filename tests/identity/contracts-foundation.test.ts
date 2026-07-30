import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  authorizationDecisionFieldOrder,
  identityContractNamespace,
  identityContractSchemaVersion,
  identityContractVersion,
  identityErrorCodes,
  type AuthorizationDecision,
  type AuthorizationRequest,
  type IdentityResolver,
  type PolicyResolver,
} from "@/platform/identity";

describe("gid-1001 identity contracts", () => {
  it("exports baseline contract version metadata", () => {
    expect(identityContractVersion).toBe("1.0.0");
    expect(identityContractNamespace).toBe("genesis.identity");
    expect(identityContractSchemaVersion).toBe("gid-1001.v1");
  });

  it("defines stable machine error codes", () => {
    expect(identityErrorCodes).toEqual([
      "IDENTITY_NOT_FOUND",
      "INVALID_CREDENTIAL",
      "EXPIRED_CREDENTIAL",
      "DISABLED_IDENTITY",
      "INVALID_SESSION",
      "EXPIRED_SESSION",
      "REVOKED_SESSION",
      "MISSING_MEMBERSHIP",
      "PERMISSION_DENIED",
      "POLICY_DENIED",
      "PROVIDER_UNAVAILABLE",
      "FEDERATION_FAILURE",
      "CONTRACT_MISMATCH",
      "AUDIT_FAILURE",
      "INTERNAL_IDENTITY_FAILURE",
    ]);
  });

  it("preserves deterministic authorization decision field order", () => {
    expect(authorizationDecisionFieldOrder).toEqual([
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
    ]);
  });

  it("keeps authentication request and authorization request separated", () => {
    const request: AuthorizationRequest = {
      requestId: "req-1",
      principalId: "principal-1",
      action: "resource:view",
      resource: { resourceId: "x" },
    };

    expect("credential" in request).toBe(false);
    expect("authenticationContext" in request).toBe(false);
  });

  it("provides typed port interfaces for resolver and policy contracts", () => {
    const resolver: IdentityResolver = {
      async resolvePrincipalById() {
        return null;
      },
      async resolveSubjectByPrincipalId() {
        return null;
      },
    };

    const policyResolver: PolicyResolver = {
      async resolvePolicies() {
        return [];
      },
    };

    expect(typeof resolver.resolvePrincipalById).toBe("function");
    expect(typeof policyResolver.resolvePolicies).toBe("function");
  });

  it("avoids application-specific dependencies inside identity contracts and ports", () => {
    const roots = [
      join(process.cwd(), "src", "platform", "identity", "contracts"),
      join(process.cwd(), "src", "platform", "identity", "ports"),
    ];

    const bannedPatterns = [
      /\bglw\b/,
      /\bssi\b/,
      /\bstoner\b/,
      /\brj metal\b/,
      /@\/app\//,
      /@\/components\//,
      /@\/lib\/glw/,
    ];

    for (const root of roots) {
      const files = readdirSync(root).filter((file) => file.endsWith(".ts"));
      for (const file of files) {
        const content = readFileSync(join(root, file), "utf8").toLowerCase();
        for (const pattern of bannedPatterns) {
          expect(pattern.test(content)).toBe(false);
        }
      }
    }
  });

  it("supports deterministic JSON structures in authorization decisions", () => {
    const decision: AuthorizationDecision = {
      decisionId: "d-1",
      allowed: false,
      reasonCode: "POLICY_DENIED",
      principalId: "principal-1",
      workspaceId: "workspace-1",
      resource: { resource: "project", projectId: "p-1" },
      action: "project:update",
      policyId: "policy-1",
      grants: [],
      denials: [
        {
          denialId: "deny-1",
          principalId: "principal-1",
          reasonCode: "POLICY_DENIED",
          reason: "Policy denied request.",
        },
      ],
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    };

    expect(decision.allowed).toBe(false);
    expect(decision.denials[0]?.reasonCode).toBe("POLICY_DENIED");
  });
});
