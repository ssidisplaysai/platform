# GLW Campaign Launchpad

Campaign Launchpad is the reach-first GLW workflow for evaluating a product campaign before execution. The operator selects desired reach, submits a canonical product URL as an onboarding seed, and reviews Genesis authority, coverage, conflicts, publication policy, and safe target capacity.

V1 is read-only. `POST /api/glw/campaign-launchpad/preflight` authenticates the workspace request, accepts only HTTP(S) URLs, resolves the URL against the registered site and product repositories, and reuses the existing GLW canonical target preflight. It can issue registered WordPress API reads but has no campaign, product, source-authority, publication, or WordPress mutation path. The Launch Campaign control remains disabled.

Maximum Safe Reach is the number of targets that current authority confirms are absent and eligible after known duplicate coverage is excluded. Targets with incomplete product/source authority or unverified canonical state are blocked rather than counted as safe. Campaign ownership and cannibalization remain `UNAVAILABLE` until those services expose a certified read-only planner contract.

Phase 2 should consume the certified preflight response and pass its exact site, product, canonical target set, draft-only publication policy, and operator-selected bounded size into the existing page-generation execution service. It must revalidate the preflight immediately before enqueue and must not introduce separate campaign persistence or targeting logic.