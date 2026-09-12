# Genesis Certified Baseline 2026-09-12

## Certification identity

- Certified tag: `genesis-certified-2026-09-12`
- Certified source SHA: `dae8b1c3d4dcbb451a4801aa26536b5b02a28c6e`
- Branch at certification: `feature/glw-research-content-sufficiency-v1`
- Focused tests: `162/162 PASS`
- Regression: `PASS`
- Production build: `PASS`

The source certification tag is not authorization to replace the currently certified production runtime on port 3001. Runtime promotion remains a separate, explicit deployment and certification action.

## Certified production runtime

- 3001 source SHA: `03860b9b5d03f20aebf13519e95719ed2fe9bd77`
- 3001 build: `6hNgqSwFUv1ZW4mOvfL14`
- Certification action: none. This baseline did not replace, restart, or promote 3001.

## Preserved live evidence

### ProjectorEnclosure Texas

Campaign: `campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities`

- Austin: `reference_complete`
- Dallas: `draft_ready`
- Dallas WordPress object: `13084`
- Dallas WordPress status: `draft`
- Dallas canonical path: `fan-cooled-projector-enclosures/texas/dallas`
- Houston: `queued`
- San Antonio: `queued`
- Campaign publication performed: no

### Commercial Stainless Counters

- Launch certification: passed
- Canonical HTTPS origin, WordPress `home`, and WordPress `siteurl`: verified
- Approved navigation hierarchy: bound to the active Twenty Twenty-Five header
- Theme page-list fallback: removed from the active header
- Theme shell/footer defaults: sanitized
- Public homepage and nested market route: HTTP 200, exact canonical, one H1, no placeholder links, no development URL leakage
- Genesis publishing state: ready and enabled

## Certified reusable protections

- Release-bound campaign activation capability
- Single-use campaign activation grants
- Reference approval distinct from activation
- Activation distinct from dispatch
- Explicit owner dispatch confirmation
- One-target campaign concurrency enforcement at route and durable lease boundaries
- MCP configuration and authenticated tool preflight before leasing
- Exact campaign/site/organization, target, lease, job, execution, and WordPress identities
- Expired no-job lease recovery and exact-job reconciliation
- `CONTENT_READY` distinct from WordPress persistence
- `draft_ready` means an exact WordPress draft was persisted and verified by readback
- Draft-only publication separation and explicit publication policy gates
- City-aware WordPress publication reconciliation
- Anonymous public-site certification before Genesis activation
- Canonical HTTPS, WordPress `home`/`siteurl`, rendered H1, SEO/indexability, redirect, link, orphan, media, default-artifact, leakage, brand, and viewport certification
- Approved WordPress navigation authority binding and theme/default artifact detection
- `PRODUCT_AUTHORITY` media role for approved physical-product truth
- `CONTEXTUAL_IN_USE` media role for separate deployment/context imagery
- Generated contextual media requires hashed `PRODUCT_TRUTH` grounding
- Owner continuation surfaces expose truthful next actions and refresh server-rendered state after mutation

## Repository and secret hygiene

- Environment files, `.next`, Turbopack caches, persistence state, root GLW runtime logs, local PID files, and local WordPress credential stores are ignored.
- No runtime credentials, MCP tokens, WordPress application passwords, or local credential stores are tracked by this baseline.
- Synthetic credential values in credential-store tests are fixtures and contain no production secret material.
- Existing `tools/out/generated` institutional analysis artifacts are intentionally tracked repository evidence, not runtime cache output.

## High-risk review boundary

Existing CODEOWNERS mappings require explicit Genesis runtime/security/engineering review for campaign activation and scheduling, lease/concurrency behavior, MCP execution, reconciliation, WordPress mutation, publication, runtime supervision, credential loading, public certification, and image authority/provenance.

The repository default branch must reject force pushes and deletion, require pull requests and CODEOWNER review, and require CI checks once real check contexts exist. Certified tags matching `genesis-certified-*` must reject update and deletion.

## Development continuation

Future operator UI work begins from the certified source SHA on branch `feature/genesis-operator-ui-v1` in a separate worktree. The tag remains fixed while normal development continues through new commits and branches.
