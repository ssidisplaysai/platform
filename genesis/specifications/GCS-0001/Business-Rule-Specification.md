# Business Rule Specification

## Normative Requirements
- A conforming compiler MUST evaluate governed rules against evidence-derived canonical facts.
- Rule evaluation MUST be deterministic for identical inputs and versions.
- Rule outcomes MUST be one of: PASS, FAIL, WARNING, INFO, UNKNOWN, BLOCKED, CERTIFICATION HOLD.
- Rule evaluation MUST capture rule identifier, rule version, inputs, outputs, confidence, provenance, replay identifier, and certification status.

## Normative Prohibitions
- Rules MUST NOT create evidence.
- Rules MUST NOT bypass conflict resolution, dependency, or priority governance.

## Informative Guidance
This specification defines normative behavior corresponding to WS-IIID architecture contracts.
