# Allowed Dependencies

## Allowed Runtime Dependencies
- Replay Runtime contracts and records.
- Existing deterministic utilities already approved in foundation runtime stack.
- Manifest and evidence linkage metadata already present in upstream records.

## Allowed Imports (Category Level)
- Internal runtime contract modules for Replay and IBR boundary interfaces.
- Deterministic identity/hash utilities approved by foundation governance.
- Immutable data handling utilities approved by foundation governance.

## Required Linkage Coverage
IBR outputs must preserve and expose references for:
- Replay linkage
- Manifest linkage
- Evidence linkage
- Certification linkage
- Version lineage linkage

## Registry Behavior Requirement
IBR registry behavior must be deterministic:
- deterministic key derivation
- explicit version registration
- append-only historical visibility
- duplicate handling by deterministic replacement or rejection rule defined before certification