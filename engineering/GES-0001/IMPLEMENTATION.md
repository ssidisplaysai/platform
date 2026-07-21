# IMPLEMENTATION

## Approach

The package implements the canonical evidence model as a frozen, serialized value object backed by strict TypeScript types.

The core design choices are:

- Normalize every input field before construction.
- Preserve JSON-only content so serialization stays deterministic.
- Compute integrity over a canonical payload that excludes the integrity object itself.
- Reject malformed records at parse time rather than letting them flow through the model.

## Production Surface

- `CanonicalEvidence.create()` constructs a normalized, immutable record from validated input.
- `CanonicalEvidence.fromJSON()` parses and validates a previously serialized record.
- `CanonicalEvidence.toJSON()` returns a canonical JSON-compatible record.
- `generateCanonicalEvidenceSchema()` emits a JSON Schema for downstream tooling.

## Determinism

- Arrays that do not carry semantic order are normalized into stable sorted order.
- Object keys are serialized in lexical order before hashing.
- Object keys are serialized in deterministic code-unit order before hashing.
- The checksum is SHA-256 over the canonical payload.

## Validation Rules

- Required string fields must be non-empty.
- Identifiers must use a constrained printable format.
- Timestamps must parse as valid ISO date-time values.
- JSON payloads and metadata maps must remain JSON-compatible.
- Structure nodes and relationships must not duplicate ids.
- Integrity checksums must match the canonical payload.