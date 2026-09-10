# Site Intelligence and Creative Direction V1

Connected sites can open **Site Intelligence** before product onboarding. Opening the workspace is read-only and does not start research. **START SITE INTELLIGENCE** is the explicit durable boundary.

## Authority Model

- Market observations and inferred opportunities retain source reference, source type, observed claim, retrieval time, entity, confidence, evidence strength, and authority class.
- A discovered opportunity is not evidence that the organization performs the capability.
- Capability authority requires an explicit owner decision and evidence reference for verified or qualified states.
- Rejected and future capabilities cannot be used as generation authority.
- Opportunity approval authorizes strategy consideration only. It creates no product, page, campaign, or asset.

## Approval Progression

1. Start bounded site intelligence.
2. Review opportunities and choose Approve, Research More, Hold, or Reject.
3. Confirm, qualify, reject, or mark future business capabilities with owner evidence and notes.
4. Approve reviewed intelligence.
5. Create or edit a versioned site strategy proposal, then approve, request revision, or reject it.
6. Add optional classified creative references and preferences.
7. Create or edit a versioned creative brief, homepage blueprint, and image plan from approved strategy.
8. Approve, request revision, or reject creative direction.

## Asset Safety

Only `OWNER_APPROVED_PUBLISHABLE` is publishable. Owner references, generated candidates, external inspiration, competitor references, unverified assets, and rejected assets cannot be published automatically.

V1 keeps site generation disabled even after all approvals. Product authority, campaign planning, WordPress mutation, and publication remain separate workflows. Fresh sites remain `draft_only` unless separately authorized outside this workspace.

## Provider Boundary

The durable workspace records a provider reference but does not embed provider credentials. Future bounded web, owner-source, connected-source, n8n, and model synthesis providers can write evidence-backed opportunity proposals through the site-scoped authority without creating campaign targets or execution records.

## Binary Inputs and Research Execution

Creative uploads accept JPEG, PNG, WebP, GIF, and PDF files. Files are limited to 25 MB each, 10 files and 50 MB per batch. Genesis validates MIME and file signatures, stores bytes by SHA-256 under the foundation persistence root, and records organization/site provenance. Upload does not call WordPress.

Automatic execution requires the dedicated n8n endpoint `https://ssiai.app.n8n.cloud/webhook/genesis-site-intelligence-v1` through `GENESIS_SITE_INTELLIGENCE_WEBHOOK_URL` and `GENESIS_SITE_INTELLIGENCE_WEBHOOK_SECRET`. Campaign research credentials and workflow identities are not reused. The provider must echo exact organization/site/execution identity and return evidence-linked opportunities. Execution is idempotent for the initial run, limited to two attempts, bounded to 60–300 seconds, and becomes recoverable after exhaustion.