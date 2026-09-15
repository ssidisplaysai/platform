# Genesis Go-Live Convergence V1

## Trusted session convergence

Certified commit `23e0e3bceb25d75272ec8436ca2976c3d91ff90b` is integrated with Agent 2 commit `b42a83cae852cefbeb3f50d95c5c953dbea12dbc`.

`GENESIS_SERVER_SESSION_V1` now supplies GLW reference authority through `resolveAuthenticatedOperatorPrincipal(request)`. Principal ID, session ID, roles, capabilities, authentication time, expiry, and authority are server-derived. Session transport uses a random HttpOnly strict cookie, a server-side token hash, bounded expiry, revocation state, and same-origin CSRF for mutations. Production authorization ignores caller role, principal, email, owner, and session headers.

The current Agent 2 runtime has no `GENESIS_OPERATOR_DIRECTORY_JSON` binding and no existing session record. The integration is complete, but normal owner actions remain unavailable until Robert provisions a real directory entry and signs in. No synthetic directory, password, or owner identity was created.

## California media 15338

Bounded provenance is proven and persisted at `docs/genesis/evidence/ssi-accent-ca-media-15338-lineage-v1.json`:

- CA job `e2f30c1d-8511-4435-a15b-f0110c66eb63`, external execution `478029`
- persisted job media authority selected `GENERATED_MEDIA`
- job completed with `featuredImagePresent=true`
- WordPress page `15336` uses featured media `15338`
- attachment title `Accent Rear Projection Film in California`
- attachment file `2026/09/california.jpg`
- attachment created `2026-09-07T16:13:34Z`, seconds before job completion
- semantic role `LOCAL_CONTEXTUAL_ATMOSPHERE`

The evidence does not contain the provider generation ID, original byte hash, or historical owner approval. Those facts are not inferred. Owner approval remains `REQUIRED`.

Campaign detail now exposes `Approve CA Media 15338`. It is enabled only when a server-verified operator session exists and posts the exact media ID plus lineage fingerprint with session-bound CSRF. It never mutates WordPress or publishes.

## California host certification

Authenticated WordPress REST can read exact draft object `15336`, its body, hierarchy, metadata, and featured media. It does not establish a browser-authenticated WordPress preview session. Anonymous preview requests return 404. Therefore actual host header/footer integration, theme title behavior, computed contrast, and host geometry cannot be certified through the normal flow yet.

Campaign detail exposes a disabled `Run Authenticated Draft Host Certification` action with blocker `WordPress browser-preview session authority unavailable`. REST-body evidence remains: one H1, expected body, structural SEO/navigation pass, and zero overflow at 1440/1024/768/375. This is not promoted to actual-host certification.

## Indiana preflight

The Outdoor LED Sphere Indiana retry flow is integrated with `GENESIS_SERVER_SESSION_V1`. It can resolve exact campaign/state/fingerprints/runtime/failed-job evidence and issue preflight receipts only after a real operator session exists. No preflight receipt, grant, job, MCP/n8n call, or generation occurred.

Current blocker: `GENESIS_OPERATOR_DIRECTORY_JSON` is unconfigured, so `resolveAuthenticatedOperatorPrincipal` returns no principal and the authority endpoint fails closed.