# Relationship Resolution Specification

## Normative Requirements
- A conforming compiler MUST resolve relationships only from governed evidence-backed inputs.
- Relationship outcomes MUST include source entity, target entity, relationship type, confidence, authority, provenance, replay identifier, and certification status.
- Relationship lifecycle states and transitions MUST be deterministic and auditable.
- Relationship records MUST be immutable and append-only.

## Normative Prohibitions
- A conforming compiler MUST NOT invent relationships.
- A conforming compiler MUST NOT produce unresolved references to non-canonical identities.

## Informative Guidance
This specification defines normative behavior corresponding to WS-IIIC architecture contracts.
