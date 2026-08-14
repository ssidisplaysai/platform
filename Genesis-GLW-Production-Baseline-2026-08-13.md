# Genesis GLW Production Baseline (2026-08-13)

## Date
- 2026-08-13

## Git Context
- Branch: recovery/genesis-platform-1.1.1-bge
- Commit before closeout: f0d00bd6fddb895d5817182a6d394566895a57a1
- Final commit after closeout: Recorded in closeout report and baseline tag created during this procedure.

## Build and Test Results
- Focused GLW tests:
  - Command: npm test -- tests/glw/generate-page-ui.test.tsx tests/glw/page-generation-api.test.ts
  - Result: PASS (2 suites, 33 tests)
- TypeScript:
  - Command: npx tsc --noEmit
  - Result: PASS (exit code 0)
- Build:
  - Command: npm run build
  - Result: PASS (Next.js build completed successfully)

## Known-Good GLW Architecture State
Validated production path:
- GLW
- Cloudflare
- n8n production webhook
- content/page generation
- WordPress hierarchy
- WordPress page create/update
- image generation
- image conversion/optimization
- WordPress media upload
- image alt text
- hero image insertion
- QA
- GLW completion callback

## Canonical Payload Contract (Must Remain Intact)
- site.id = led-display-warehouse
- site.name = LED Display Warehouse
- workspace identity preserved independently via:
  - workspaceId
  - workflowContext.workspaceId
- Verified preserved fields:
  - workflowContext
  - workspaceId
  - page_type
  - product_topic
  - state
  - city
  - citySlug
  - hierarchicalSlug
  - SEO settings
  - publishing settings
  - callback URL
  - job ID

## Generate Page URL-State Repair
- Canonical entrypoint: /glw/pages?create=1
- Behavior:
  - /glw/pages => create UI closed
  - /glw/pages?create=1 => existing Create Page Request UI opens immediately
- Create mode now derives from URL/query state and remains server/client boundary safe.

## Cloudflare Routing Correction
- glw-dev.ssiai.app -> localhost:3001
- app.ssiai.app -> localhost:3001
- Prior incorrect origin (localhost:3002) caused 502 responses.

## n8n Production Workflow Identity/Version
- Not directly queried/modified during closeout.
- No n8n workflow behavior changes performed during closeout.

## Successful Production Validation Evidence
- Local health surface check:
  - GET http://localhost:3001/api/glw/health => HTTP 200
  - build_id: B6aYI8KxBS5to2Kafka5v
  - git_commit reported by running process: f0d00bd6fddb895d5817182a6d394566895a57a1
- Local version surface check:
  - GET http://localhost:3001/api/glw/version => HTTP 200
  - callback_contract_version: 16
  - qa_contract_version: 16
  - schema_version: glw-job-schema-v1

## Approved Image-Generation Baseline (Do Not Change)
Generation:
- Model: gpt-image-1-mini
- Quality: medium
- Resolution: 1536x1024 landscape
- Prompt constraints:
  - photorealistic
  - premium commercial website hero image
  - wide landscape composition
  - LED display/product dominant
  - realistic lighting, architecture, materials, scale
  - people only when appropriate
  - no words/city names/letters/logos/captions/signs/watermarks/UI text/readable typography
  - no text on LED screen
  - avoid poster-style composition

Optimization and upload:
- Edit Image output: approximately 1200x800
- JPEG quality: 85
- WordPress upload content type: image/jpeg
- Filename extension: .jpg

Hero presentation baseline:
- max-width: 760px
- centered
- width: 100% responsive
- height: auto
- border radius: 8px
- margin: approximately 20px top / 28px bottom

## Known Non-Blocking Warnings
- Health payload status.state currently reports WARNING while readiness/liveness are READY/LIVE and capability compatibility remains true.
- Health payload includes source: SIMULATED in record metadata.

## Intentionally Deferred
- Large set of unrelated modified/untracked repository artifacts outside the focused GLW closeout scope were not cleaned or deleted in this closeout.
- Branch has no upstream tracking configured; push target policy requires explicit branch handling.

## Recommended Starting Point for Tomorrow
Start from the baseline commit/tag produced in this closeout, verify /glw/pages and /glw/pages?create=1 behavior in the first smoke pass, then continue only with planned scoped work while preserving canonical GLW payload identity and approved image pipeline settings.
