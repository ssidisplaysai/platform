# GACP-0002A - Validation Matrix

| # | Category | Command | Result | Notes |
|---|---|---|---|---|
| 1 | Changed file diagnostics | get_errors on remediated files and operations center test file | PASS | No errors found |
| 2 | Focused test | npx jest tests/gop/gop-operations-center.test.tsx --runInBand | PASS | 1 suite, 1 test |
| 3 | Focused lint | npx eslint "src/app/glw/(protected)/operations/page.tsx" "src/app/glw/(protected)/page.tsx" "src/app/glw/(protected)/pages/page.tsx" "src/app/glw/(protected)/queue/page.tsx" "src/components/gop/gop-operations-center.tsx" "tests/gop/gop-operations-center.test.tsx" | PASS | No lint output |
| 4 | GAR baseline refresh | npm run gar:scan | PASS | GAR-0001 inventory regenerated with determinism PASS |
| 5 | GAR dependency-direction regeneration | npm run gar2:scan | PASS | GAR-0002 evidence regenerated from refreshed GAR-0001 baseline |
| 6 | GAR evidence schema validation | npm run gar2:validate | PASS | valid=true, findingsSchemaValid=true |
| 7 | Dependency delta proof | Node diff script comparing HEAD GAR-0002 evidence vs regenerated evidence | PASS | In-scope removed=7, in-scope remaining=0, full A2I 112->105, new violations=0 |
| 8 | Counter availability check | Node check of dependency-direction-analysis.json fields | PASS | Intentional/False-positive counters are not modeled before/after |
| 9 | Protected route observation | Regenerated evidence inspection | PASS WITH OBSERVATION | src/app/glw/(protected)/layout.tsx runtime loader seam remains unchanged and out of scope |

## Findings Classification
- Blocker: None
- Major: None
- Minor: None
- Observation: src/app/glw/(protected)/layout.tsx still imports runtime loader and remains intentionally unmodified in GACP-0002A.
