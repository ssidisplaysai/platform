# Entity Resolution Specification

## Normative Requirements
- A conforming compiler MUST resolve entity identity from governed evidence-derived facts.
- Entity identity decisions MUST be deterministic for identical inputs and versions.
- Entity resolution outcomes MUST include confidence, authority, provenance, replay identifier, and certification status.
- Entity resolution records MUST be immutable and append-only.

## Normative Prohibitions
- A conforming compiler MUST NOT invent identities without governed supporting evidence.
- A conforming compiler MUST NOT suppress contradicting evidence in identity decisions.

## Informative Guidance
This specification defines normative behavior corresponding to WS-IIIB architecture contracts.
