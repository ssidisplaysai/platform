# GID-1003 Architecture Delta

## Before
- Authorization policy evaluation lived in GOP runtime resolver paths.
- No dedicated identity authorization service abstraction.
- No dedicated authorization mission-control health/metrics endpoints.

## After
- Authorization is a dedicated identity capability under `src/platform/identity/authorization`.
- GOP resolver now adapts legacy request/decision contracts and delegates to identity authorization service.
- Health and metrics surfaces are available for authorization capability.

## Key Design Decisions
- Strict auth/authz boundary: authentication verifies identity; authorization evaluates access.
- Compatibility-first adapter: preserve GLW/GOP resolver API and reason codes.
- Deterministic deny precedence: explicit policy deny over allow; fallback default deny.
- Workspace and ownership checks occur before policy evaluation.

## Risk Controls
- No authentication code path modifications.
- Focused compatibility regression tests for existing GOP authorization behavior.
- Cache is bounded by TTL and can be invalidated.
