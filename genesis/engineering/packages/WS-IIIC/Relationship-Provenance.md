# Relationship Provenance

## Purpose
Define required provenance guarantees for relationship decisions.

## Provenance Questions
Every relationship SHALL answer:
1. Which evidence created me?
2. Which compiler version processed me?
3. Which rule created this decision?
4. Which identity decisions are upstream dependencies?
5. Which replay manifest reproduces me?

## Provenance Requirements
Each relationship record SHALL include:
- Evidence references with immutable identifiers
- Rule identifier and rule set version
- Compiler version
- Business Genome version
- Source identity decision references from WS-IIIB
- Replay identifier and replay manifest reference
- Certification status and attestation reference

## Provenance Integrity
Provenance links SHALL be tamper-evident and immutable.
Broken provenance references SHALL fail certification.

## Cross-Package Traceability
WS-IIIC provenance SHALL link to upstream artifacts from:
- WS-I model semantics
- WS-II evidence contracts
- WS-III compiler contracts
- WS-IIIA execution context
- WS-IIIA-R1 instruction context
- WS-IIIB identity resolution outputs
