# Genesis Commerce Platform Validation Debt Baseline

## Baseline Context
- Baseline commit under review: 0886e23
- Current HEAD during baseline capture: 0886e2383a78283c1aa26d48171daafedf1cacd4
- Scope statement: 0886e23 changed only documentation files under genesis/engineering/packages/GCP-0002A

## Command Outcome Matrix

| Command | Exit Code | Status Classification | Primary Failure Ownership | Representative Error Categories | Predates 0886e23 | Introduced By GCP-0002A | Regression Result |
|---|---:|---|---|---|---|---|---|
| npm ls --depth=0 | 0 | PASS | N/A | N/A | N/A | N/A | PASS |
| npx tsc --noEmit | 2 | KNOWN BASELINE FAILURE | Platform-wide compiler/tests and shared domains | type incompatibilities, missing required fields, readonly mutation violations, test context contract drift | Yes | No | NO NEW REGRESSION |
| npm run lint | 1 | KNOWN BASELINE FAILURE | Platform-wide tools/templates/runtime domains | no-explicit-any, no-assign-module-variable, ban-ts-comment, no-require-imports, unused vars | Yes | No | NO NEW REGRESSION |
| npm test -- --runInBand | 1 | KNOWN BASELINE FAILURE | Platform-wide test suites and compiler pipelines | empty test suites, assertion failures, deterministic expectation mismatches | Yes | No | NO NEW REGRESSION |
| npm run build | 1 | KNOWN BASELINE FAILURE | Compiler planning and shared type domains | next build typecheck failure in existing compiler planning code | Yes | No | NO NEW REGRESSION |
| node tools/genesis/genesis.mjs test | 1 | KNOWN BASELINE FAILURE | Tooling/runtime test harness | harness-level failures in existing tool/runtime suites | Yes | No | NO NEW REGRESSION |
| Test-NetConnection localhost:5432 | 0 | PASS | N/A | N/A | N/A | N/A | PASS |
| Test-NetConnection localhost:5678 | 0 | ENVIRONMENTAL BLOCKER | Local infrastructure dependency | n8n service endpoint unreachable | N/A | No | BLOCKED BY ENVIRONMENT |
| Prisma validation command | N/A | NOT APPLICABLE | N/A | No root prisma/schema.prisma detected | N/A | N/A | N/A |

## Failure Classification Rules Used
- KNOWN BASELINE FAILURE: command fails due pre-existing source/test/tooling debt unrelated to 0886e23 docs-only scope.
- NEW REGRESSION: not detected in this package.
- ENVIRONMENTAL BLOCKER: failure caused by unavailable local/external infrastructure rather than source code deltas.
- NOT APPLICABLE: required artifact or subsystem not present in this repository snapshot.
- PASS: command completed successfully.

## Machine-Readable Snapshot
```json
{
  "baselineCommit": "0886e23",
  "capturedAtHead": "0886e2383a78283c1aa26d48171daafedf1cacd4",
  "results": [
    {"command":"npm ls --depth=0","exitCode":0,"status":"PASS","ownership":"N/A","regression":"PASS"},
    {"command":"npx tsc --noEmit","exitCode":2,"status":"KNOWN BASELINE FAILURE","ownership":"platform-wide compiler/tests","regression":"NO NEW REGRESSION"},
    {"command":"npm run lint","exitCode":1,"status":"KNOWN BASELINE FAILURE","ownership":"tools/templates/runtime","regression":"NO NEW REGRESSION"},
    {"command":"npm test -- --runInBand","exitCode":1,"status":"KNOWN BASELINE FAILURE","ownership":"platform-wide tests/compiler","regression":"NO NEW REGRESSION"},
    {"command":"npm run build","exitCode":1,"status":"KNOWN BASELINE FAILURE","ownership":"compiler planning/shared types","regression":"NO NEW REGRESSION"},
    {"command":"node tools/genesis/genesis.mjs test","exitCode":1,"status":"KNOWN BASELINE FAILURE","ownership":"tools runtime harness","regression":"NO NEW REGRESSION"},
    {"command":"Test-NetConnection localhost:5432","exitCode":0,"status":"PASS","ownership":"N/A","regression":"PASS"},
    {"command":"Test-NetConnection localhost:5678","exitCode":0,"status":"ENVIRONMENTAL BLOCKER","ownership":"local infrastructure","regression":"BLOCKED BY ENVIRONMENT"},
    {"command":"Prisma validation","exitCode":null,"status":"NOT APPLICABLE","ownership":"N/A","regression":"N/A"}
  ]
}
```

## Comparator Guidance For Future Packages
1. Re-run commands in the same order.
2. Compare command, exit code, and status classification.
3. Mark any new non-zero status on previously passing command as NEW REGRESSION.
4. Keep environmental blockers separate from source-code regressions.
