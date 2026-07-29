# Genesis Commerce Platform Multi-Site Validation

## Focused Validation
| Command | Exit Code | Classification | Baseline Comparison |
|---|---:|---|---|
| npm ls | 0 | PASS | New evidence command |
| editor diagnostics check for touched files (get_errors) | 0 | PASS | Focused type validation available in workspace diagnostics |
| npx eslint src/components/layout/app-shell.tsx src/app/sites src/app/api/sites src/modules/foundation | 0 | PASS | Focused lint pass |
| npm test -- src/modules/foundation/__tests__/commerce-foundation.test.ts src/modules/foundation/__tests__/multi-site-foundation.test.ts --runInBand | 0 | PASS | Focused foundation suites pass |

## Route Smoke Validation
Target routes:
1. /
2. /companies
3. /settings
4. /notifications
5. /audit
6. /search
7. /sites
8. /sites/new
9. /sites/site-led-display-warehouse-production
10. /sites/site-led-display-warehouse-production/settings
11. /sites/site-led-display-warehouse-production/health

Expected result: HTTP 200 for valid routes.

## API Authorization Validation
| Command Pattern | Result | Classification |
|---|---|---|
| GET /api/sites | 200 | PASS |
| POST /api/sites with x-gcp-roles=viewer | 403 | PASS |
| POST /api/sites with x-gcp-roles=ops_manager and valid unique slug | 201 | PASS |
| PATCH /api/sites/[siteId] with x-gcp-roles=viewer | 403 | PASS |
| POST /api/sites/[siteId]/connection-test with x-gcp-roles=ops_manager | 200 | PASS |

## Repository-Wide Baseline Validation
| Command | Exit Code | Classification | Baseline Comparison |
|---|---:|---|---|
| npx tsc --noEmit | 1 | KNOWN BASELINE FAILURE | Pre-existing compiler/test typing debt remains |
| npm run lint | 1 | KNOWN BASELINE FAILURE | Pre-existing repository-wide lint debt remains |
| npm test | 1 | KNOWN BASELINE FAILURE | Pre-existing broad suite failures remain |
| npm run build | 1 | KNOWN BASELINE FAILURE | Pre-existing compiler planning type mismatch remains |

Repository-wide failure profile remains baseline-aligned and is not attributed to GCP-0002C touched files.

## Security Checks
1. No raw secrets introduced in site contracts.
2. No `.env` files staged.
3. No publishing runtime execution introduced.

## Final Validation Intent
No new regression should be attributed to touched GCP-0002C files under focused validation.
