# GLW Reference Generation Single-Use Owner Authority V1

## Result

`GLW_REFERENCE_GENERATION_OWNER_AUTHORITY_V1` is a reusable server-side authority primitive for initial and retry reference generation. This implementation does not generate content, issue the Indiana grant, create a job or lease, consume allowance, invoke MCP/n8n, or mutate WordPress.

The current application has no server-verified Genesis operator session. `context.ts` supplies a static display identity, while `api-auth.ts` accepts caller-controlled role and scope headers. Neither is authentication. The trusted-principal resolver therefore fails closed with `TRUSTED_OPERATOR_SESSION_UNAVAILABLE`; role headers alone can never issue or consume this authority.

Prerequisite for operational issuance: install a server-verified operator session provider that supplies an immutable principal ID and session ID to `resolveGlwTrustedOperatorPrincipal`.

## Contract

- Preflight receipts are server-stored, exact-context records with a 120-second lifetime.
- Owner grants are opaque, server-issued, server-stored records with a 300-second lifetime.
- Grant consumption atomically changes `ACTIVE` to `CONSUMED` and creates one opaque claim.
- The final page-generation boundary atomically marks that claim used. A replay is denied.
- Persistence uses the foundation file lock and optimistic revision check. Concurrent consumers yield one successful write and one denial/conflict before downstream work.
- Initial and retry operation types are distinct. Retry context additionally requires a terminal failed job and exact persisted artifact SHA.
- Every mismatch has a stable sanitized code. No authority relies on client-submitted fingerprints as truth; live context is rebuilt from campaign, reference files, product authority, WordPress read authority, runtime, and failed execution evidence.

## Entry points

Two executable reference-generation boundaries exist:

1. Campaign reference endpoint: `POST /api/glw/campaigns/[campaignId]/reference-page`. It resolves a trusted principal, rebuilds live preflight context, and consumes the exact grant before generation forwarding.
2. Final GLW generation endpoint: `POST /api/glw/page-generation`. Campaign-reference requests require the consumed claim and atomically consume it at the dispatch boundary before mutation preflight or `service.execute`.

The issuance endpoint is `GET|POST /api/glw/campaigns/[campaignId]/reference-authority`. GET reports capability. POST supports `RUN_PREFLIGHT` and `AUTHORIZE`, but both fail before request processing while trusted session authority is unavailable.

## Operator contract

The campaign UI names campaign, state, operation type, and failed job for retry. It exposes `Run Preflight` / `Run Retry Preflight` and `Authorize Reference Generation` / `Authorize One Retry`. These controls are disabled with the explicit trusted-session prerequisite in the current runtime; there is no indefinite checking state.

## Indiana preparation

No Indiana grant or receipt is created. The next authorization must bind the new deployed runtime, not `7b6bba9e0d772542a35c094140178e02834afd02`. Current campaign/reference/product/QA/failed-artifact fingerprints remain available from the hardened reference workflow after deployment.