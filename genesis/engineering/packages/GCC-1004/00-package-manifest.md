# GCC-1004 Package Manifest

## Package Identity
- Package ID: GCCKG-GCC-1004-v1.0.0
- Subject ID: GCC-1004
- Subject Version: 1.0.0
- Package Version: 1.0.0
- Package Status: Frozen
- Review Status: Approved
- Engineering Status: Complete
- Integrity Status: Sealed
- Governance Decision: GD-0007

## Purpose
GCC-1004 delivers the Genesis Canonical Knowledge Compiler. It deterministically transforms validated Evidence IR into immutable Knowledge IR with canonical entity resolution, conflict preservation, temporal validity, provenance retention, and governed compiler-core integration.

## Package Contents
- Human-readable package reports and readiness documents
- Machine-readable validation, traceability, impact, and metrics JSON
- Deterministic package checksum manifest
- Canonical package manifest
- Package metadata file (`package.json`)
- Package archive and canonical download archive

## Scope Boundaries
- Foundation artifacts were not modified.
- GCC-1001 was not redesigned.
- GCC-1002 was not redesigned.
- The compiler changes are limited to the knowledge compiler, the core pass wrapper, and the knowledge-facing exports needed by the governed pipeline.

## Change Summary
- Added a canonical Knowledge IR compiler with deterministic clustering, entity/fact construction, conflict preservation, and immutability.
- Integrated the knowledge compiler into the governed compiler core as a dedicated pass.
- Added focused tests for deterministic ordering, duplicate consolidation, conflict preservation, and snapshot immutability.