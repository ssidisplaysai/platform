# Architecture Delta

## Before GID-1002

- Authentication logic was concentrated in GLW module code.
- Identity contracts and ports existed as architecture baseline only.
- No dedicated provider registry or reusable authentication pipeline.
- No dedicated identity authentication health or metrics API endpoints.

## After GID-1002

- Introduced canonical platform authentication service under src/platform/identity/services.
- Introduced provider abstraction and local credential provider under src/platform/identity/providers.
- Introduced reusable GLW-compatible session codec and session service under src/platform/identity/session.
- Introduced GLW compatibility adapter that preserves legacy call surface while delegating authentication lifecycle to platform identity service.
- Added GOP identity authentication health and metrics endpoint surfaces.

## Boundary Confirmation

- Authorization services and policy logic were not implemented or expanded.
- No protocol-level federation/SSO components were introduced.
- Authentication changes are additive and compatibility-scoped.
