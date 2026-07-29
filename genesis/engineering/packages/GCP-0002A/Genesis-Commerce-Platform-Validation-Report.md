# Genesis Commerce Platform Validation Report

## Validation Matrix

| Validation Item | Command or Method | Executed | Result | Classification | Evidence Summary |
|---|---|---|---|---|
| Dependency validation | npm ls --depth=0 | Yes | PASS | PASS | Dependency graph resolved and listed installed packages |
| TypeScript | npx tsc --noEmit | Yes | FAIL | KNOWN BASELINE FAILURE | Pre-existing compiler/test typing failures; not introduced by docs-only 0886e23 |
| Lint | npm run lint | Yes | FAIL | KNOWN BASELINE FAILURE | Pre-existing tools/templates/runtime lint debt |
| Unit tests | npm test -- --runInBand | Yes | FAIL | KNOWN BASELINE FAILURE | Pre-existing empty-suite and compiler regressions |
| Build | npm run build | Yes | FAIL | KNOWN BASELINE FAILURE | Existing compiler planning typecheck blocker |
| Genesis test framework | node tools/genesis/genesis.mjs test | Yes | FAIL | KNOWN BASELINE FAILURE | Existing tooling/runtime harness failures |
| Database validation | Test-NetConnection localhost:5432 | Yes | PASS (port) | PASS | Database port reachable; query-level validation unavailable in current local tool wiring |
| Dashboard smoke | Browser + HTTP checks | Yes | PASS | PASS | App routes loaded and rendered; no blocking page errors detected |
| n8n execution | Test-NetConnection localhost:5678 | Yes | FAIL | ENVIRONMENTAL BLOCKER | n8n endpoint not reachable and no local deployment method found in repo |
| WordPress draft/publish | npx tsx marketing-engine/runtime/pat/PAT-0001-leddisplaywarehouse.mts | Yes | BLOCKED | ENVIRONMENTAL BLOCKER | PAT generated report with NOT_EXECUTED due missing required secrets |
| Live URL verification | PAT and WordPress follow-through | Attempted | BLOCKED | ENVIRONMENTAL BLOCKER | No draft/publish IDs because execution could not proceed |
| Prisma validation | N/A | N/A | N/A | NOT APPLICABLE | No root prisma/schema.prisma detected |

## Dashboard Validation Detail
Routes validated:
- /
- /companies
- /companies/ssi
- /companies/led-display-warehouse

Observed:
- Pages rendered successfully.
- No blocking runtime exceptions captured via pageerror or console error listeners in tested routes.

## Page Generation Validation Trace
Planned path:
Dashboard -> Internal API/workflow -> n8n -> AI generation -> SEO -> image handling -> WordPress upload -> status callback

Observed in this baseline:
- PAT script executed and produced an evidence report.
- Bootstrap validation stopped execution before workflow run due unresolved secrets.
- No workflow execution IDs available.
- No WordPress draft/publish artifacts generated.

## n8n Validation Detail
- Workflow file export: not available in this workspace snapshot
- Workflow name: not discoverable from repository evidence
- Workflow ID: not discoverable from repository evidence
- Activation state: unavailable (service offline)
- Webhook reachability: unavailable (service offline)
- Credentials: not verifiable locally through n8n (service offline)
- Execution history: unavailable (service offline)

## WordPress Validation Detail
- Controlled draft creation: blocked
- Controlled publish: blocked
- Page ID: n/a
- Final URL: n/a
- Featured image verification: n/a
- Body image verification: n/a

Verified blockers from PAT report:
- OPENAI_API_KEY missing
- LED_WP_BASE_URL missing
- LED_WP_USERNAME missing
- LED_WP_APPLICATION_PASSWORD missing

## Validation Interpretation
This package achieved local platform startup and dashboard recovery objectives, and R1 adds explicit command-level debt classification. External workflow publication validation remains blocked by n8n availability and required secrets.

See detailed baseline classification:
- ../GCP-0002A-R1/Genesis-Commerce-Platform-Validation-Debt-Baseline.md
