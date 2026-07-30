# GPC-0001A-06 Access Control and IAM

Program: GPC-0001  
Work package: GPC-0001A-06  
Date: 2026-07-29

## 1. Purpose

Document current production access-control model, governance boundaries, and least-privilege posture.

## 2. Authentication and Authorization Boundary Consistency

Boundary consistency with certified architecture and prior work packages is preserved:
1. Session-gated operator access for GLW.
2. Authorization resolver for GOP operations/metrics and job actions.
3. Worker protocol signed-token boundary for non-session worker flows.

Evidence:
- src/lib/glw/page-generation-api.ts:44
- src/lib/gop/events-api.ts:25
- src/lib/gop/events-api.ts:45
- src/lib/gop/operations-api.ts:19
- src/lib/gop/workers-api.ts:33

## 3. Least-Privilege Model

Repository-defined least-privilege controls:
1. Role hierarchy with explicit role ordering.
2. Viewer role restricted to read-only surfaces.
3. Viewer mutation actions explicitly denied by policy.
4. Ownership guard for viewer role on owner-scoped resources.
5. Default deny when no policy allows request.

Evidence:
- src/platform/gop/auth/resolver.ts:11
- src/platform/gop/auth/policies.ts:293
- src/platform/gop/auth/policies.ts:413
- src/platform/gop/auth/resolver.ts:135
- src/platform/gop/auth/resolver.ts:150

## 4. Administrative Access Model

Current administrative boundary:
1. ADMINISTRATOR role inferred from GLW_ADMIN_EMAIL match.
2. Non-admin authenticated identities default to VIEWER role.
3. Admin policies include broad access in joined workspaces.

Evidence:
- src/platform/gop/auth/authorization.ts:15
- src/platform/gop/auth/authorization.ts:18
- src/platform/gop/auth/authorization.ts:21
- src/platform/gop/auth/policies.ts:12

Risk:
1. Repository does not include enterprise IdP group mapping, MFA policy, or privileged-access workflows.

## 5. Workspace and Route Access Governance

Controls:
1. Workspace membership required for workspace-scoped requests.
2. Route authorization uses route:view action reference.
3. Metrics and operations endpoints require explicit metrics:view authorization.

Evidence:
- src/platform/gop/auth/resolver.ts:120
- src/platform/gop/auth/resolver.ts:127
- src/platform/gop/auth/authorization.ts:79
- src/lib/gop/events-api.ts:91
- src/lib/gop/operations-api.ts:30

## 6. Service Accounts and API Credential Governance

Repository-visible controls:
1. Worker protocol authentication supports signed token mode and token binding.
2. Worker token validation enforces signature and expiry.
3. n8n webhook uses bearer credential for integration boundary.

Evidence:
- src/lib/gop/workers-api.ts:168
- src/lib/gop/workers-api.ts:39
- src/platform/gop/runtime/worker-token.ts:44
- src/platform/gop/runtime/worker-token.ts:68
- src/lib/glw/n8n.ts:96

Condition:
1. Cloud IAM role/service-account provisioning and lifecycle are external controls and must be evidenced externally.

## 7. Infrastructure Access Controls and Production Governance

Repository-governed release/access guardrails:
1. Production release requires certification and release approval stages.
2. CI gate runs atlas certification chain from clean dependency install.

Evidence:
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:43
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:44
- .github/workflows/atlas-guardrails.yml:23
- .github/workflows/atlas-guardrails.yml:26
- package.json:20

Condition:
1. Runtime cloud access controls (firewall, WAF, bastion, network ACL, IAM enforcement) are external and deferred to register evidence.
