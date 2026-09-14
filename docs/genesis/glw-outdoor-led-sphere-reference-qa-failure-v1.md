# GLW Outdoor LED Sphere Reference QA Failure V1

## Immutable Evidence

- Campaign ID: `campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview`
- Site ID: `site-led-display-warehouse-production`
- Failed state: `IL` (`Illinois`)
- Failed job ID and request correlation ID: `3df15069-2cd8-4aec-93f3-70a9f5ee3029`
- n8n execution ID: `626685`
- Job created: `2026-09-14T21:33:29.878Z`
- Job completed: `2026-09-14T21:34:34.294Z`
- Status: `FAILED`
- Error code: `GENERATED_CONTENT_QA_FAILED`
- WordPress object ID: none

### Generated artifact

- Storage authority: `glw-page-execution-repository` / `generatedDraft`
- HTML length: `19687` characters (`19722` UTF-8 bytes)
- Word count: `2307`
- SHA-256: `eed2b6450c8ba975c78e51e5f603993a4306632e48946ffb64c2128b7b404371`
- Structural completeness: complete (`18/18` headings and `11/11` paragraphs closed)

### Campaign authority

- Instructions revision: `1`
- Instructions length: `18266` characters (`18371` UTF-8 bytes)
- Instructions SHA-256: `d939fbed38c8d2d5fd1cd8fa531b5df7a80029fb0faba1119b2450ffdd02c5a3`
- Reference ID: `ref-1789418032554-u8knyrg`
- Reference file: `Outdoor Digital Sphere Installations (2).pdf`
- Reference size: `10393059` bytes
- Reference SHA-256: `1fb840ba639b9c15251f413ac84e38c850fec78cd520544001639adb39fd2e6e`
- Reference text: one page, 375 characters

## Persisted QA Result

Gate: `evaluateGlwGeneratedContentQa` (unversioned legacy gate)

Nine of ten predicates passed. The sole persisted failure was:

- Predicate: `stateProductAuthorityLink`
- Expected: visible exact anchor `Outdoor Digital Sphere` linking to `/outdoor-digital-sphere/`
- Observed: zero anchor elements in the persisted artifact
- Evidence: `State pages must link Outdoor Digital Sphere to /outdoor-digital-sphere/.`
- Severity: blocking

The gate correctly rejected the missing link. The pre-QA enrichment path incorrectly compared the configured domain case-sensitively against `leddisplaywarehouse.com`; the stored site domain is `LEDDisplayWarehouse.com`, so deterministic SEO/link enrichment was skipped. The fallback internal-link registry also covers only the indoor-sphere product.

An in-memory replay of the exact artifact through the intended enrichment inserted the required product link and passed the current ten-predicate gate. The replay was not persisted.

## Grounding Review

The uploaded PDF supports only immersive 360-degree display technology and installations across varied environments. The campaign instructions explicitly state that no authoritative factual source was supplied and require unsupported product, installation, service, specification, pricing, certification, compliance, and availability claims to be omitted or framed as questions.

The artifact is only partially grounded and includes unsupported assertions, including:

- `Weatherproof Construction: Materials must withstand moisture, temperature swings, UV exposure, and debris.`
- `select products with brightness ratings suitable for local lighting conditions`
- `many digital spheres can support interactivity` through motion sensors, mobile apps, or social feeds
- providers offering `local installation assistance`, training, and timely service response
- `Illinois venues continue to adopt immersive visual formats`
- `Outdoor installations in Illinois nearly always require compliance with zoning, signage, and event ordinances.`
- `confirm safety certifications before event deployment or public use`

No explicit price, current inventory, local office, or direct LEDDisplayWarehouse.com installation claim was found.

The artifact therefore requires material claim repair or a new governed generation after QA/enrichment repair. Adding only the missing link is insufficient.

## State Selection Finding

The controlled selector sends its current client value directly. The durable job proves `IL` was submitted. The owner-reported intent was Indiana (`IN`), but the displayed selection at submission was not persisted. The selector defaults to `AL` after reload. No code evidence supports a stale-state race; `IL` and `IN` are adjacent options. The state discrepancy did not cause the missing-link QA failure.

## Retry Readiness

No automatic retry is authorized. Any future retry must use a new single-use owner authorization bound to:

- campaign ID
- site ID
- reference state
- failed job ID
- failed artifact SHA-256
- campaign instruction SHA-256
- reference PDF SHA-256
- current site-scoped WordPress read authority

The operator state is `REFERENCE_BLOCKED`. Safe action: `DO_NOT_RETRY_ESCALATE`. Proposed future recovery: `REQUEST_NEW_EXACT_RETRY_AUTHORIZATION_AFTER_QA_REPAIR`.
