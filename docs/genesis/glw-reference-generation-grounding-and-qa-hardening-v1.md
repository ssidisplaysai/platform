# GLW Reference Generation Grounding and QA Hardening V1

## Scope and preservation

This change hardens future campaign reference generation. It does not retry generation, repair the failed Illinois artifact, invoke n8n/MCP, create a WordPress object, publish, or dispatch.

The certified Illinois job `3df15069-2cd8-4aec-93f3-70a9f5ee3029` and artifact SHA-256 `eed2b6450c8ba975c78e51e5f603993a4306632e48946ffb64c2128b7b404371` remain immutable forensic evidence.

## Authority contract

- Canonical site host: `leddisplaywarehouse.com`. Case, HTTP/HTTPS scheme, `www`, URL path/trailing slash, and URL host representation normalize before exact equality. Substring and suffix matching are prohibited.
- Product authority: exact organization `led-display-warehouse`, site `site-led-display-warehouse-production`, product `prod-outdoor-digital-sphere`, anchor `Outdoor Digital Sphere`, path `/outdoor-digital-sphere/`.
- Product-authority fingerprint: `202532bb42258a02757b0e36aabf716c68d82a1ab2796dfe8c899418d14f9f8f`.
- Campaign-instruction fingerprint: `d939fbed38c8d2d5fd1cd8fa531b5df7a80029fb0faba1119b2450ffdd02c5a3`.
- Reference fingerprint for `Outdoor Digital Sphere Installations (2).pdf`: `1fb840ba639b9c15251f413ac84e38c850fec78cd520544001639adb39fd2e6e`.
- QA policy: `GLW_REFERENCE_CLAIM_AUTHORITY_V1`.

Campaign reference requests bind all four fingerprints. Both the campaign endpoint and final page-generation endpoint reject stale authority before dispatch. The PDF is a campaign-wide content reference, not blanket factual authority. It supports immersive 360-degree display technology and installations across varied environments only; it does not establish local adoption, climate requirements, services, warranty, pricing, inventory, or technical specifications.

## Claim safety

The versioned policy classifies findings with claim text, class, authority source, authority kind, and status. Supported statuses are `SUPPORTED`, `APPROVED_CONCEPTUAL`, and `REVIEW_REQUIRED`; factual claims with `UNSUPPORTED` status block QA readiness. Explicit questions and modal conceptual language are distinguished from documentary assertions.

Implemented classes: `LOCATION_FACT`, `MARKET_ADOPTION`, `CLIMATE`, `PRODUCT_CAPABILITY`, `PRODUCT_SPECIFICATION`, `DURABILITY`, `INGRESS_PROTECTION`, `BRIGHTNESS`, `INTERACTIVITY`, `REMOTE_MANAGEMENT`, `INSTALLATION_SERVICE`, `TRAINING`, `WARRANTY`, `SERVICE_AVAILABILITY`, `PRICING`, and `INVENTORY`.

The exact preserved Illinois artifact still fails. Hardened QA adds 24 unsupported findings across 13 present classes: `LOCATION_FACT`, `MARKET_ADOPTION`, `CLIMATE`, `PRODUCT_CAPABILITY`, `PRODUCT_SPECIFICATION`, `DURABILITY`, `INGRESS_PROTECTION`, `BRIGHTNESS`, `INTERACTIVITY`, `INSTALLATION_SERVICE`, `TRAINING`, `WARRANTY`, and `SERVICE_AVAILABILITY`. No pricing, inventory, or remote-management phrase matched the preserved bytes.

## Durable Indiana selection and retry boundary

Reference state selection is repository-backed and survives reload. The owner-selected next state is Indiana (`IN`); the UI renders `Reference State: Indiana (IN)` and keeps the failed Illinois operation separate.

The workflow projects `REFERENCE_RETRY_READY`, but retry remains disabled. The prepared contract binds campaign, site, Indiana, failed job, failed artifact SHA, current instruction/reference/product fingerprints, QA policy, WordPress read-authority state, exact runtime, duplicate protection, and a required new single-use owner authorization. No grant is created here; previous authority is not reusable and automatic retry is false.

The operator sees the prior Illinois state, failed job ID, QA summary, explicit no-WordPress-object result, safe status, and next Indiana state without terminal inspection.

## Reproducible proof

Run `scripts/glw-reference-hardening-proof.mts` with `GLW_FORENSIC_PERSISTENCE_DIR` pointing to the shared read-only evidence root. The script verifies the certified artifact SHA, runs versioned claim QA, emits all failures and fingerprints, and asserts repository bytes are unchanged.