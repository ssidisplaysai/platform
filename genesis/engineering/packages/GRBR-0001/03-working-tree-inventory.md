# 03 Working Tree Inventory

## Baseline Snapshot
- Source: evidence/grbr-status-porcelain.txt
- Total changed entries at capture: 146
- Status split: 51 modified, 95 untracked

## Root Bucket Summary
- src: 59
- genesis: 50
- tools: 21
- tests: 5
- single-file roots and other roots: 11

## Classification Rule
- GOVERNANCE_SYNC_CANDIDATE: README.md, STATUS.md, genesis/architecture/README.md, genesis/architecture/ARCHITECTURE_MANIFEST.md
- PRIOR_PACKAGE_ARTIFACT: existing package files unrelated to GRBR execution scope
- UNRELATED_OR_AMBIGUOUS: all other changes
- GRBR_IN_SCOPE: only GRBR-0001 package artifacts created in this execution

## Per-Entry Classification
The full per-entry table covering all 146 entries is preserved in:
- evidence/working-tree-classification-table.md

## Staging Safety Conclusion
At baseline capture, no safe minimal staging set exists for non-risk commit because the working tree is dominated by unrelated or ambiguous changes and branch is behind upstream.