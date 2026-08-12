# GAR-0001-Final-Report

Classification legend: VERIFIED | INFERRED | OPINION | RECOMMENDATION | UNRESOLVED

## Disposition
VERIFIED: READY WITH DOCUMENTED LIMITATIONS

## Location Selection
VERIFIED: Tooling implemented under tools/genesis-audit based on existing tooling convention.
VERIFIED: Evidence package emitted under genesis/audits/GAR-0001 for additive audit outputs.
OPINION: Placement aligns with existing repository tooling segregation and additive audit artifact precedent.

## Inventory Totals
VERIFIED: Files scanned = 2360
VERIFIED: Directories scanned = 806
VERIFIED: Source files parsed = 1312
VERIFIED: Symbols extracted = 17729
VERIFIED: Graph nodes = 1312
VERIFIED: Graph edges = 3541
VERIFIED: Unresolved imports = 15

## Determinism
VERIFIED: Run hashes = 1cde471e31c239e1dfd577f7c0c609bab2aac2526c047511d5639d0e340098d5, 1cde471e31c239e1dfd577f7c0c609bab2aac2526c047511d5639d0e340098d5, 1cde471e31c239e1dfd577f7c0c609bab2aac2526c047511d5639d0e340098d5
VERIFIED: Deterministic match across 3 runs = true

## Mutation Check
VERIFIED: Pre-scan source snapshot hash = 9af912e37c8f04d02db78c5670fd32f0662e86f287f31ad589bc99c3c42d4538
VERIFIED: Post-scan source snapshot hash = 9af912e37c8f04d02db78c5670fd32f0662e86f287f31ad589bc99c3c42d4538
VERIFIED: Source mutation detected = false

## Validation Results
VERIFIED: schema validation => PASS
VERIFIED: determinism x3 => PASS
VERIFIED: repository mutation check => PASS

## Limitations
UNRESOLVED: Static analysis cannot prove runtime security posture.
UNRESOLVED: Unknown/binary file semantic parsing is intentionally limited.
UNRESOLVED: Ownership inference from folder layout is not authoritative.

