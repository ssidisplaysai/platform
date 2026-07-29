# 05 Authoritative Input Model

## Input Families
1. Constitutional sources.
2. Governance and standards sources.
3. Program/package manifests.
4. Capability architecture sources.
5. Validation, certification, and release records.
6. Traceability and repository impact records.

## Input Requirements
Each admissible source shall expose:
1. Source identifier.
2. Source path.
3. Source version or release marker.
4. Certification state.
5. Lifecycle state.
6. Authority tier.

## Immutability Rules
1. Frozen and certified artifacts are read-only inputs.
2. Source mutation attempts are compiler-fatal.
3. Supersession is represented as lineage, not overwrite.
