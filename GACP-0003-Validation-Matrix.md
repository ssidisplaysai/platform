# GACP-0003 - Validation Matrix

| # | Category | Command | Result | Notes |
|---|---|---|---|---|
| 1 | Changed file diagnostics | get_errors on updated bootstrap/layout/auth/test files | PASS | No errors found |
| 2 | Focused tests | npx jest tests/gop/platform-bootstrap-api.test.ts tests/gop/loader-context.test.ts tests/gop/authorization-resolver.test.ts --runInBand | PASS | 3 suites, 6 tests |
| 3 | GOP regression | npx jest tests/gop --runInBand | PASS | 17 suites, 47 tests |
| 4 | Focused lint | npx eslint src/platform/gop/auth/runtime.ts src/lib/gop/platform-bootstrap-api.ts src/app/glw/(protected)/layout.tsx tests/gop/platform-bootstrap-api.test.ts | PASS | No lint output |
| 5 | GAR baseline refresh | npm run gar:scan | PASS | Determinism allEqual=true, mutation=false, schema valid |
| 6 | GAR dependency regeneration | npm run gar2:scan | PASS | GAR-0002 evidence regenerated from refreshed GAR-0001 baseline |
| 7 | GAR evidence validation | npm run gar2:validate | PASS | valid=true, findingsSchemaValid=true |
| 8 | Dependency metrics proof | Node extraction against dependency-direction-analysis.json | PASS | A2I 105->104, layout seam 4->3, new violations=0 |

## Validation Disposition
- Blocker: None
- Major: None
- Minor: None
