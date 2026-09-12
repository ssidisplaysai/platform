# Genesis Two-Lane Contracts V1

This note records reusable platform behavior learned from the ProjectorEnclosure Texas campaign and Commercial Stainless Counters launch. It is a contract map, not a site-specific runbook.

## Campaign lifecycle

Reusable contracts now enforce:

- Reference approval, single-use owner authorization, exact-release capability, activation, dispatch, reconciliation, WordPress draft persistence, and publication are separate transitions.
- Activation does not dispatch. Scheduler mutation requires authentication, exact organization/site/campaign scope, explicit owner confirmation, authoritative dispatch date, live MCP tool preflight, daily allowance, and available campaign concurrency.
- Durable leasing enforces the campaign concurrency limit. Targets with jobs reconcile by exact job identity; expired no-job leases can return to the queue; pre-execution failures can requeue without blind redispatch.
- `CONTENT_READY` is generated content awaiting exact continuation. `draft_ready` means an exact WordPress draft ID was persisted and verified. Publication remains policy-gated.
- City targets retain state, city slug, city name, lease, job, execution, canonical path, and WordPress object identity. Publication reconciliation verifies product -> state -> city hierarchy.
- Owner interfaces display city/state identity, capability blockers, exact jobs and WordPress IDs, and refresh server-rendered state after mutation.

Daily allowance counts distinct targets stamped with the authoritative dispatch date. Retrying the same target on that date does not consume another unit. Failed or interrupted attempts are not silently refunded.

## Fresh-site publication

Reusable contracts cover public WordPress preflight, authenticated draft identity, exact object/canonical slug/content/media/SEO review, publication planning, explicit authorization, resumable execution, and final Genesis transition.

Final verification now also runs site-neutral anonymous public certification for:

- HTTPS canonical origin and WordPress `home`/`siteurl` consistency
- final URL and declared redirects
- rendered title, meta description, canonical, indexability, and exact H1
- placeholder links, undeclared internal routes, orphan routes, and broken media
- default WordPress/theme artifacts
- development URL and governance/process copy leakage
- visible public brand identity
- supplied desktop/mobile navigation and overflow evidence

Commercial Stainless canonical-host, Twenty Twenty-Five navigation/template-part repair, and legacy redirect implementations remain site adapters. Their literals must not be moved into generic contracts. A future provisioning phase should consume a parameterized launch manifest for theme IDs, navigation structure, old redirects, and default-artifact policy.

## Page image package

The durable media-assignment contract distinguishes:

- `PRODUCT_AUTHORITY`: an approved existing product asset with exact product and authority identity. Generated media cannot satisfy this role.
- `CONTEXTUAL_IN_USE`: a separate generated or approved contextual asset. Generated contextual media must retain provider/model/prompt/output hash and a hashed `PRODUCT_TRUTH` reference input.

Assignments bind organization, site, build session, page revision, slot, role, final alt/title/description, owner approval, and optional verified WordPress receipt. Duplicate page-revision/slot assignments and stale revision reuse fail closed.

When an approved product image is available it is required. Contextual media follows profile policy: `REQUIRED` blocks when absent; `DESIRED` degrades explicitly to product-image-only without inventing product identity. Existing page review resolves approval by exact slot and latest decision.

## Next phase

Return to normal Genesis production use. Larger follow-up work should focus on parameterized theme-shell provisioning, durable browser-evidence capture, authenticated principal identity instead of role-only attribution, full assignment consumption by multi-slot WordPress assembly, and iterative operator UI/UX improvements.
