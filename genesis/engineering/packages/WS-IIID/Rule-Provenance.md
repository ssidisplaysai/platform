# Rule Provenance

## Purpose
Define provenance requirements for rule evaluations and outcomes.

## Provenance Questions
Every rule result SHALL answer:
1. Which evidence supported this?
2. Which entities participated?
3. Which relationships participated?
4. Which compiler version?
5. Which rule version?
6. Which replay manifest?

## Provenance Requirements
Each rule outcome SHALL include:
- Evidence identifiers
- Participating entity identifiers
- Participating relationship identifiers
- Compiler version
- Rule version
- Rule identifier
- Replay identifier and replay manifest reference
- Certification status and attestation reference

## Provenance Integrity
Provenance references SHALL be immutable and tamper-evident.
Missing provenance references SHALL block certification.

## Cross-Package Linkage
WS-IIID provenance SHALL link to upstream governance outputs from WS-I, WS-II, WS-III, WS-IIIA, WS-IIIA-R1, WS-IIIB, and WS-IIIC.
