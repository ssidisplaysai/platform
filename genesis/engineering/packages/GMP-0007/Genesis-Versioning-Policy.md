# Genesis Versioning Policy

## Versioning Requirements
Every integration contract shall define:
- Contract version
- Producer
- Consumer
- Payload
- Schema
- Compatibility rules
- Deprecation rules

## Compatibility Rules
- Backward-compatible changes are preferred.
- Breaking changes require version increments and explicit deprecation.
- Versioning must be deterministic and traceable.

## Boundary Statement
Versioning governs contract evolution only. It does not imply runtime implementation.
