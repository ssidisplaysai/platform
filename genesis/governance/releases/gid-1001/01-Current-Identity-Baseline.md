# 01 - Current Identity Baseline

## Purpose
Document existing identity-related behavior in the repository before introducing GID-1001 architecture artifacts.

## Files Inspected
Core authentication/session:
- src/lib/glw/auth.ts
- src/app/glw/login/actions.ts
- src/app/glw/login/page.tsx
- src/app/glw/actions.ts
- src/app/glw/(protected)/layout.tsx

Current auth compatibility and authorization runtime:
- src/platform/gop/auth/authentication.ts
- src/platform/gop/auth/authorization.ts
- src/platform/gop/auth/resolver.ts
- src/platform/gop/auth/runtime.ts
- src/platform/gop/auth/policies.ts
- src/platform/gop/contracts.ts
- src/platform/gop/workspaces/identity.ts

Protected route permission resolvers (representative pattern):
- src/app/glw/(protected)/agents/access.ts
- src/app/glw/(protected)/executive/access.ts
- src/app/glw/(protected)/finance-agent/access.ts
- src/app/glw/(protected)/manufacturing-agent/access.ts
- src/app/glw/(protected)/operations-agent/access.ts
- src/app/glw/(protected)/marketing-agent/access.ts
- src/app/glw/(protected)/sales-agent/access.ts
- src/app/glw/(protected)/customer-success-agent/access.ts
- src/app/glw/(protected)/orchestrations/access.ts
- src/app/glw/(protected)/memory/access.ts
- src/app/glw/(protected)/tools/access.ts
- src/app/glw/(protected)/projects/[id]/analytics/access.ts

API authorization wrappers (representative pattern):
- src/lib/gmp/api.ts and GMP API modules
- src/lib/gop/events-api.ts
- src/lib/gop/executions-api.ts
- src/lib/gop/fabric-api.ts
- src/lib/gop/operations-api.ts
- src/lib/gop/workers-api.ts
- src/lib/gea/*-api.ts
- src/lib/gba/*-api.ts
- src/lib/ged/enterprise-domain-api.ts

Mission Control assumptions:
- src/app/page.tsx
- src/modules/mission-control/MissionControlPage.tsx
- src/components/layout/app-shell.tsx

## Current Authentication Flow
1. Login action reads email/password from form in src/app/glw/login/actions.ts.
2. Credentials are validated against environment variables in src/lib/glw/auth.ts:
   - GLW_ADMIN_EMAIL
   - GLW_ADMIN_PASSWORD
3. On success, createGlwSession writes signed cookie glw_session using HMAC SHA-256 with GLW_AUTH_SECRET.
4. Login redirects to /glw.
5. Protected GLW layout and many API handlers load session via getGlwSession.
6. Missing session produces redirect (/glw/login) in protected layout or 401 in many APIs.

## Current Authorization Flow
1. Session is converted to authenticated identity using getGenesisAuthenticatedIdentityFromSession.
2. Identity is converted to authorization subject via createGenesisAuthorizationSubjectFromIdentity.
3. Role is inferred primarily by admin email equality:
   - ADMINISTRATOR if identity.email == GLW_ADMIN_EMAIL
   - otherwise VIEWER
4. Workspace membership is built by buildGenesisWorkspaceMemberships using fixed primary workspace.
5. Policy evaluation uses createGenesisAuthorizationResolver over genesisDefaultPolicies.
6. Access checks are action-based via resolver.authorize; default deny applies.

## Current Session Model
- Cookie name: glw_session
- Format: base64url(JSON payload).signature
- Signature: HMAC-SHA256 with GLW_AUTH_SECRET
- Payload fields: email, expiresAt
- TTL: 12 hours
- Cookie attributes: httpOnly, sameSite=lax, secure in production, path=/, maxAge=TTL
- Session revocation: cookie deletion on logout

## Current Permission Model
- Permissions are string-based action IDs (example: gea:agents:view).
- Policy model supports roles, permissions, workspace/module filters, actions, extension IDs, job constraints.
- Viewer is read-limited by policy; admin and higher roles inherit broader access.
- Decision includes reason code and policyId for explainability.

## Current Workspace Model
- Primary workspace identity is currently fixed to GLW reference workspace:
  - workspaceId: glw-led-display-warehouse
  - workspaceKey: glw
  - moduleId default: glw.core
- Membership and many permission checks assume this default workspace.

## Current Authority Overlaps
- Authentication concerns are currently GLW-specific (env-admin credential path).
- Authorization subject, policy, and route checks are in GOP auth runtime.
- Session handling and platform authorization are coupled through GLW session cookie.
- Business modules consume authorization decisions directly, sometimes with module-specific access helpers.

## Compatibility Pathways
- Existing APIs often accept injected sessionLoader dependencies for tests/compatibility.
- Runtime exposes auth compatibility utilities under src/platform/gop/auth/runtime.ts.
- Existing protected-route access.ts files provide a pattern that can be adapted to future identity platform ports.

## Mission Control Access Assumptions
- Root app route currently renders Mission Control UI without explicit GLW login enforcement.
- GLW protected route tree enforces authentication and route authorization.
- Future identity architecture must preserve current behavior unless explicitly migrated under future work orders.

## GLW Access Assumptions
- GLW login is single-admin-credential driven.
- GLW protected pages depend on session presence and policy checks.
- API handlers consistently return unauthorized/forbidden when session or authorization checks fail.

## Risks
- Current admin-email role inference does not scale to multi-user enterprise identity.
- Workspace and module defaults are currently static and GLW-centered.
- Session-as-identity coupling can blur authority boundaries without a dedicated identity platform layer.
- Broad action permission lists can become hard to govern without centralized identity ownership.

## Constraints
- Do not break current GLW login/session behavior.
- Do not redesign certified GPR-1.0 platform services.
- Do not implement production identity provider integrations in GID-1001.
- Do not migrate existing application authentication in GID-1001.
