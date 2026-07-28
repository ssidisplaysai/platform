# GAR-0002A Validation Report

## Command Results

### GAR-0001 baseline validation
Command:
- `node -e "import { validateOutputs } from './tools/genesis-audit/src/schema-validator.mjs'; const out=validateOutputs('genesis/audits/GAR-0001'); console.log(JSON.stringify(out,null,2)); if(!out.valid) process.exit(1);"`

Result:
- PASS (`valid: true`)

### GAR-0002 validation (pre-scan)
Command:
- `npm run gar2:validate`

Result:
- PASS (`valid: true`, `findingsSchemaValid: true`)

### GAR-0002 scan (with canonical hashing)
Command:
- `npm run gar2:scan`

Result highlights from `genesis/audits/GAR-0002/evidence/gar-0002-run-manifest.json`:
- `gar0001HashingMethod`: `git-blob-canonical-sha256`
- `gar0001SchemaValidation.valid`: true
- `gar0001HashConsistency`: true
- `gar0001HashMismatchDetails`: []
- `validations.deterministicOutputVerification.allEqual`: true
- `validations.repositoryMutationCheck.mutated`: false

### GAR-0002 tests
Command:
- `npm run gar2:test`

Result:
- PASS (1 suite, 2 tests)

### GAR-0002 validation (post-scan)
Command:
- `npm run gar2:validate`

Result:
- PASS (`valid: true`, `findingsSchemaValid: true`)

## Cross-Platform Canonical Hash Proof
Proof command compared 11 files using three methods per file:
- raw working-tree hash
- LF-normalized text hash
- canonical Git blob hash

Result:
- All 11 files: `rawMatchesExpected = false`
- All 11 files: `lfMatchesExpected = true`
- All 11 files: `blobMatchesExpected = true`
- All 11 files: `canonicalPass = true`

This demonstrates Windows CRLF checkout variance is eliminated by canonical hashing.

## Required Outcome Matrix
- GAR-0001 baseline presence: PASS
- GAR-0001 schema validation: PASS
- GAR-0001 canonical hash validation: PASS
- GAR-0002 validation: PASS
- GAR-0002 determinism: PASS
- GAR-0002 mutation guard: PASS
- Repository mutation: false

## Constraints Compliance
- GAR-0001 evidence not regenerated.
- GAR-0001 evidence not rewritten.
- GAR-0002 findings logic unchanged.
- Production code unchanged.
- No commit, push, or tag performed.
