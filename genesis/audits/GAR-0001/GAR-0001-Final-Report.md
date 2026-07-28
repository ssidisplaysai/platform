# GAR-0001-Final-Report

Classification legend: VERIFIED | INFERRED | OPINION | RECOMMENDATION | UNRESOLVED

## Disposition
VERIFIED: READY WITH DOCUMENTED LIMITATIONS

## Location Selection
VERIFIED: Tooling implemented under tools/genesis-audit based on existing tooling convention.
VERIFIED: Evidence package emitted under genesis/audits/GAR-0001 for additive audit outputs.
OPINION: Placement aligns with existing repository tooling segregation and additive audit artifact precedent.

## Inventory Totals
VERIFIED: Files scanned = 2061
VERIFIED: Directories scanned = 765
VERIFIED: Source files parsed = 1306
VERIFIED: Symbols extracted = 17514
VERIFIED: Graph nodes = 1306
VERIFIED: Graph edges = 3530
VERIFIED: Unresolved imports = 15

## Determinism
VERIFIED: Run hashes = c0d5e9f95044733b66841ba4b272d5a6628a9b94708c3bee10ffca908ac99dc0, c0d5e9f95044733b66841ba4b272d5a6628a9b94708c3bee10ffca908ac99dc0, c0d5e9f95044733b66841ba4b272d5a6628a9b94708c3bee10ffca908ac99dc0
VERIFIED: Deterministic match across 3 runs = true

## Mutation Check
VERIFIED: Pre-scan source snapshot hash = 94d6ef13c8fa497aa584ec0fd62adc5af9e9897f089ae4a724a3bf44095c2419
VERIFIED: Post-scan source snapshot hash = 94d6ef13c8fa497aa584ec0fd62adc5af9e9897f089ae4a724a3bf44095c2419
VERIFIED: Source mutation detected = false

## Validation Results
VERIFIED: schema validation => PASS
VERIFIED: determinism x3 => PASS
VERIFIED: repository mutation check => PASS

## Limitations
UNRESOLVED: Static analysis cannot prove runtime security posture.
UNRESOLVED: Unknown/binary file semantic parsing is intentionally limited.
UNRESOLVED: Ownership inference from folder layout is not authoritative.

