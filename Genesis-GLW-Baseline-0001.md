# Genesis GLW Baseline 0001

Status: CERTIFIED
Date: 2026-07-30
Baseline ID: GLW-BASELINE-0001

## Executive Summary
This document freezes the first fully functioning end-to-end GLW Pages baseline after successful runtime validation.

The certified validation run completed with the following identifiers:
- GLW job: glw_ppz7fxog
- n8n execution: 47833
- WordPress page: 13478
- Final job state: COMPLETE
- Final execution state: SUCCESS

This baseline is production-candidate quality for controlled forward development, comparison, and regression detection.

## Repository Verification
- Repository root: C:/Users/rober/Documents/Stoner Platform/platform-glw
- Git remote origin: https://github.com/ssidisplaysai/platform.git
- Branch: feature/gar-0003-constitutional-assessment
- Commit at certification start: bb3dcc4c56bd5ed4dce2aaaf85d6d54a455aa87f
- Working tree status at certification start: NOT CLEAN (pre-existing tracked and untracked changes present)

Notes:
- The baseline documentation commit contains only this document.
- Existing unrelated working-tree changes were intentionally left untouched.

## Architecture Summary
GLW Pages currently operates as a Next.js runtime with authenticated protected routes, asynchronous job orchestration through n8n, and callback-driven state completion.

Core architectural pattern:
1. Authenticated operator creates a page-generation job.
2. GLW persists job and triggers n8n webhook.
3. n8n executes AI + WordPress pipeline.
4. n8n posts completion callback with bearer authentication.
5. GLW validates callback secret and marks job COMPLETE.
6. UI reads repository and execution diagnostics for observability.

## Validated Components
- Authentication
- Protected routing
- Server-side Pages hydration
- Job repository loading
- Job list rendering
- Job inspector
- n8n execution observability
- AI content generation
- WordPress page creation
- Yoast SEO update
- AI image generation
- Media upload
- Featured image assignment
- Secure callback authentication
- Completion callback delivery
- Job state transition to COMPLETE
- End-to-end runtime validation

## Known Non-Blocking Exceptions
These are operational improvement targets, not product defects.

1. Temporary Cloudflare Quick Tunnel is in use.
2. Callback HTTP status code is not explicitly logged in current node output.
3. Hydration warning exists for duration rendering.
4. HMR websocket noise appears through tunnel during development.

## Current Runtime Architecture
- Runtime target: http://localhost:3001
- Public ingress: Cloudflare quick tunnel
- Public app URL: https://universal-indicating-finding-wear.trycloudflare.com
- Protected UI entry: /glw
- Callback endpoint: POST /api/glw/jobs/callback

Primary GLW API routes:
- POST /api/glw/jobs/page
- GET /api/glw/jobs/:id
- GET /api/glw/jobs/:id/execution
- POST /api/glw/jobs/callback

## Current Workflow Architecture
- n8n workflow ID: bIDXxyWnY22G8zJC
- Trigger path: GLW page generation webhook
- Pipeline responsibilities:
  - AI content generation
  - WordPress page draft/create and updates
  - SEO field updates
  - AI image generation and upload
  - Featured image assignment
  - Completion callback to GLW
- Callback node authentication source: n8n credential-based header auth

## Current Callback Architecture
- Contract: Authorization header must be Bearer <secret>
- GLW secret source: GLW_N8N_WEBHOOK_SECRET
- n8n auth delivery: httpHeaderAuth credential (workflow node level)
- Reasoning: compatible with N8N_BLOCK_ENV_ACCESS_IN_NODE restrictions
- Callback URL for certified run:
  - https://universal-indicating-finding-wear.trycloudflare.com/api/glw/jobs/callback

## Current Observability Architecture
Primary observability channels:
1. GLW job state endpoint: GET /api/glw/jobs/:id
2. GLW execution diagnostics endpoint: GET /api/glw/jobs/:id/execution
3. n8n execution deep link surfaced by diagnostics

Execution diagnostics include:
- execution identifier
- execution state
- terminal flag
- timing information
- deep-link URL for run forensics

## Current Data Flow
1. User submits page generation request from protected GLW UI.
2. GLW creates job with callback URL and metadata.
3. GLW invokes n8n webhook endpoint.
4. n8n executes generation, WordPress, SEO, and media pipeline.
5. n8n posts authenticated completion callback to GLW.
6. GLW validates auth, stores result payload, and marks job COMPLETE.
7. UI and APIs expose terminal state and execution evidence.

## Validation Evidence
Certified run evidence:
- GLW job: glw_ppz7fxog
- n8n execution: 47833
- Callback URL used:
  - https://universal-indicating-finding-wear.trycloudflare.com/api/glw/jobs/callback
- GLW terminal state:
  - status: COMPLETE
  - completedAt: 2026-07-30T15:14:58.554Z
- n8n terminal state:
  - status: SUCCESS
  - terminal: true
  - duration: about 94.9 seconds
- WordPress result:
  - wordpressPageId: 13478
  - wordpressPostId: 13478
  - wordpressUrl: https://leddisplaywarehouse.com/?page_id=13478

Callback response evidence notes:
- Callback node completed successfully with no node error.
- Callback node output returned completed job payload.
- Explicit HTTP status code is not currently surfaced in saved node output.

## Runtime Configuration Snapshot (Secret-Safe)
Configured GLW runtime variables observed:
- DATABASE_URL (configured)
- GLW_ADMIN_EMAIL (configured)
- GLW_ADMIN_PASSWORD (configured)
- GLW_APP_URL = https://universal-indicating-finding-wear.trycloudflare.com
- GLW_AUTH_SECRET (configured)
- GLW_N8N_API_KEY (configured, redacted)
- GLW_N8N_BASE_URL (configured)
- GLW_N8N_PAGE_WEBHOOK_URL = https://ssiai.app.n8n.cloud/webhook/glw-page-generation
- GLW_N8N_WEBHOOK_SECRET (configured, redacted)

Connectivity and integration summary:
- n8n connectivity: active through GLW_N8N_PAGE_WEBHOOK_URL and GLW_N8N_API_KEY.
- callback architecture: authenticated bearer callback to /api/glw/jobs/callback.
- WordPress integration: validated through page creation and published identifiers in callback result.
- Cloudflare tunnel usage: quick tunnel used as temporary public ingress.
- observability endpoint: GET /api/glw/jobs/:id/execution.

## Known Future Improvements
Priority 1: Permanent Cloudflare Named Tunnel
- Replace quick tunnel hostname with managed named tunnel for stability and governance.

Priority 2: Execution Graph Enhancement
- Record failed node.
- Record last completed node.
- Record stack traces.
- Record execution graph.

Priority 3: Callback Response Logging
- Capture HTTP status.
- Capture latency.
- Capture headers.

Priority 4: Retry Framework
- Automatic retry.
- Dead-letter handling.
- Retry history.

Priority 5: Production Deployment Preparation
- Formalize deployment packaging, runtime hardening, and production release controls.

## Validation Summary
Validated features:
- End-to-end GLW page generation, callback completion, and observability are functioning.

Open improvements:
- Operational hardening and richer diagnostics as listed above.

Risk assessment:
- Current baseline is low-to-moderate operational risk for controlled development use.
- Main risks are tunnel ephemerality and incomplete callback transport telemetry.

Recommendation for future development:
- Continue development only from this baseline marker.
- Preserve callback auth contract and execution diagnostics behavior as compatibility invariants.
