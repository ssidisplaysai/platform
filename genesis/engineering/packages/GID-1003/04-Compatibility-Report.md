# GID-1003 Compatibility Report

## Preserved Interfaces
- `getGenesisAuthorizationResolver()` signature and call pattern remain unchanged.
- `GenesisAuthorizationRequest` input semantics preserved.
- `GenesisAuthorizationDecision` output shape preserved (`allowed`, `denied`, `reasonCode`, `reason`, `policyId`, `subject`, `resource`, `action`).

## Preserved Runtime Behaviors
- Workspace membership check remains enforced.
- Viewer ownership guard remains enforced.
- Deny policy precedence over allow policy remains enforced.
- Default deny remains enforced when no policy matches.

## Authentication Isolation
- No changes to authentication providers, session codec, session service, cookie/session management, login/logout routes, or auth compatibility adapter behavior.

## Protected Route Compatibility
- Existing GLW protected access modules continue to use existing resolver entry points and action references.
- Existing authorization boundary and runtime compatibility tests pass.
