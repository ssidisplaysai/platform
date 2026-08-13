# Genesis Platform 1.1 GMP Export Investigation

## Investigation status

This phase is investigation only. No source, config, test, or package files were changed.

## Step 1 — Capture the first failures

### TEST_FIRST_FAILURE

Command executed:

`npm test -- bge-convergence.test.ts bge-api.test.ts bge-prisma-repository.test.ts bge-repository-composition.test.ts --runInBand`

First causal failure:

- file: `src/lib/gmp/bge-knowledge-authority.ts`
- line: 36
- symbol: `normalizeBusinessGenomePayload`
- import/export path: `src/lib/gmp/bge-knowledge-authority.ts` imports `deriveBgeConfidenceFromEvidenceSignals` and `normalizeBusinessGenomePayload` from `./evidence-services`.
- diagnostic: `TypeError: (0 , evidence_services_1.normalizeBusinessGenomePayload) is not a function`

Relevant excerpt:

```ts
import { deriveBgeConfidenceFromEvidenceSignals, normalizeBusinessGenomePayload } from "./evidence-services";
...
normalizePayload(payload) {
  return {
    normalizedPayload: normalizeBusinessGenomePayload(payload),
    normalizationVersion: "gmp-bge-normalization/v1",
  };
}
```

This is the first causal failing test path because the runtime fails before the BGE repository logic is reached.

### BUILD_FIRST_FAILURE

Command executed:

`npm run build`

First causal build failure:

- file: `src/lib/gmp/bge-knowledge-authority.ts`
- line: 2
- symbol: `deriveBgeConfidenceFromEvidenceSignals`, `normalizeBusinessGenomePayload`
- import/export path: `src/lib/gmp/bge-knowledge-authority.ts` -> `./evidence-services`
- diagnostic: `Export deriveBgeConfidenceFromEvidenceSignals doesn't exist in target module` and `Export normalizeBusinessGenomePayload doesn't exist in target module`

Relevant excerpt from Next.js/Turbopack output:

```text
./src/lib/gmp/bge-knowledge-authority.ts:2:1
Export deriveBgeConfidenceFromEvidenceSignals doesn't exist in target module
... 
./src/lib/gmp/bge-knowledge-authority.ts:2:1
Export normalizeBusinessGenomePayload doesn't exist in target module
```

This is the first build-blocking error and is not a cascade from a later runtime issue.

## Step 2 — Identify the GMP symbol(s)

Affected symbols:

| SYMBOL | IMPORTING_FILE | IMPORT_PATH | EXPECTED_EXPORT_FILE | ACTUAL_EXPORT_STATUS |
|---|---|---|---|---|
| `normalizeBusinessGenomePayload` | `src/lib/gmp/bge-knowledge-authority.ts` | `./evidence-services` | `src/lib/gmp/evidence-services.ts` | MISSING |
| `deriveBgeConfidenceFromEvidenceSignals` | `src/lib/gmp/bge-knowledge-authority.ts` | `./evidence-services` | `src/lib/gmp/evidence-services.ts` | MISSING |

The current `src/lib/gmp/evidence-services.ts` contains internal helper functions:

- `confidenceFromStats`
- `qualityFromStats`
- `normalizeUrl`
- `safeRecord`

These are not exported, and there are no public exports for the canonical BGE/GMP adaptation functions expected by `bge-knowledge-authority.ts`.

## Step 3 — Trace the export chain

Canonical chain:

1. `src/lib/gmp/bge-knowledge-authority.ts`
2. imports from `./evidence-services`
3. expects exported GMP functions
4. `src/lib/gmp/evidence-services.ts`
5. exposes factory functions such as `createGmpEvidenceServices` but not the canonical adapter symbols
6. therefore the runtime contract is broken at the BGE -> GMP boundary

Broken edge:

`src/lib/gmp/bge-knowledge-authority.ts` expects public GMP exports from `src/lib/gmp/evidence-services.ts`, but the module exposes only service factory APIs and helper functions. It does not export the symbols required by the BGE knowledge authority adapter.

No `index.ts` barrel is involved in the current direct import path; the issue is a stale symbol contract within the direct GMP module boundary.

## Step 4 — Verify canonical ownership

Ownership rule:

- GMP owns knowledge, confidence, normalization, and retrieval.
- BGE consumes GMP through the canonical authority seam.

The current import pattern is a correct ownership pattern:

- BGE is not duplicating GMP logic.
- BGE is consuming GMP through a canonical adapter seam.

Primary classification: A. correct BGE consumption of GMP with a broken GMP export.

This is not a BGE ownership violation and not a duplicated authority; it is a broken GMP public export contract.

## Step 5 — Git history analysis

Important evidence from git history:

- `src/lib/gmp/evidence-services.ts` is tracked in the active repo.
- `src/lib/gmp/bge-knowledge-authority.ts` is untracked in the current branch.
- `git log -- src/lib/gmp/evidence-services.ts` shows the file was introduced in commit `94ed21f` (`genesis-pre-audit-v1`).
- `git show 94ed21f:src/lib/gmp/evidence-services.ts` confirms the module existed at that point, but the exported functions named `normalizeBusinessGenomePayload` and `deriveBgeConfidenceFromEvidenceSignals` were not present there.
- There is no historical commit in the repo showing those exact symbols in `evidence-services.ts`.

Therefore:

- LAST_KNOWN_GOOD_EXPORT_COMMIT: not determinable in this repo history
- REGRESSION_INTRODUCING_COMMIT: not determinable from commit history, but the regression is the stale or missing GMP public export contract introduced when the canonical BGE adapter was written against a symbol surface that was never actually exported.

The git evidence proves the current issue is not a branch-state accident; it is a missing public API surface in the GMP implementation module.

## Step 6 — Compare current implementation to certified intent

Documents reviewed:

- `Genesis-Canonical-Capability-Ownership-v1.2.md`
- `Genesis-Platform-Integration-Finalization-v1.0.md`
- `Genesis-BGE-Convergence-Ledger-v1.0.json`

The canonical contract documented in these files is consistent:

- BGE orchestrates.
- GMP owns normalization, confidence, and knowledge retrieval.
- BGE should consume GMP via a stable adapter seam, not internal helpers or duplicate implementations.

What BGE should import:

- BGE should import the canonical GMP adapter surface from the GMP-owned module boundary.
- The intended seam is a stable public API that converts evidence payloads and produces confidence signals.

What GMP should publicly export:

- a normalization function for BGE payloads
- a confidence function based on evidence signals
- the public GMP adapter surface needed by BGE

Does the current implementation violate the documented contract?

Yes. The BGE adapter imports symbols that are not exported by the GMP module, which breaks the contractual boundary even though the ownership intent is correct.

## Step 7 — Determine test vs production impact

Classification: MULTIPLE

Reason:

- The failing tests are triggered by the same missing export path.
- `npm run build` also fails immediately for the same reason.
- This is not a test-only issue because the build fails at module resolution time and the runtime service layer cannot initialize.

Runtime capability affected:

- BGE evidence creation and normalization path
- evidence lifecycle validation inside GED/BGE integration
- GMP confidence and normalization adaptation used by BGE execution and API endpoints

## Step 8 — Blast radius

Search evidence:

- only one direct consumer is visible in the active source: `src/lib/gmp/bge-knowledge-authority.ts`
- the import chain propagates into BGE runtime and API routes via `src/lib/bge/runtime.ts` and `src/lib/bge/api.ts`

Affected consumers:

- 1 direct symbol consumer in the current active code path
- multiple runtime surfaces through BGE runtime and API
- BGE API routes that rely on evidence creation through the canonical runtime
- tests exercising BGE convergence and BGE API flows

Blast radius: MULTIPLE_CAPABILITIES

## Step 9 — Define minimum repair

This phase does not implement the repair.

Architecturally correct minimal repair preference:

1. Restore the missing canonical GMP public exports if the implementation still exists and ownership remains GMP.
2. Reintroduce the exact symbol names expected by BGE if the logic already exists as internal helpers or relation-derived functions.
3. Correct the stale import relationship only if the canonical GMP surface already exists under a different public name.
4. If a function was removed, restore it from a proven commit history rather than duplicate logic in BGE.

Do not:

- duplicate GMP logic in BGE
- bypass GMP
- create a second knowledge authority
- redesign the interface unnecessarily

## Step 10 — Release impact

This appears to be the primary source-level blocker to reproducible Platform 1.1 certification from the current branch state.

Expected after minimum repair:

`PASS_CANDIDATE`

Not yet `PASS` because other release conditions still need independent verification after the export repair is applied.

## Final evidence summary

Primary failure point:

`src/lib/gmp/bge-knowledge-authority.ts` importing missing GMP exports from `src/lib/gmp/evidence-services.ts`

Affected GMP symbol:

`normalizeBusinessGenomePayload`, `deriveBgeConfidenceFromEvidenceSignals`

Broken export edge:

`src/lib/gmp/bge-knowledge-authority.ts` -> `./evidence-services` -> missing public exports

Root cause classification:

A. correct BGE consumption of GMP with a broken GMP export

Test impact:

Mandatory focused BGE suites fail with `TypeError: ... normalizeBusinessGenomePayload is not a function`.

Build impact:

Next.js/Turbopack fails at compile time because the export does not exist.

Production impact:

BGE evidence creation, normalization, and confidence derivation cannot initialize through the canonical GMP seam.

Blast radius:

MULTIPLE_CAPABILITIES

Last known good commit:

not determinable from repository history

Regression introducing commit:

not determinable from repository history; the stale missing API contract is the root issue

Minimum repair:

restore canonical GMP public export surface for the BGE adapter contract without duplicating logic

Expected release outcome after repair:

PASS_CANDIDATE
