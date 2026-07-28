# 07 Terminology Consistency Review

## Reviewed Terms
Program, Package, Foundation, Framework, Service, Kernel, Runtime, Capability, Artifact, Registry, Manifest, Decision, Evidence, Entity, Object, Relationship, Identity, Contract, Interface, Lifecycle, Disposition, Certification, Freeze, Release, Remediation, Supersession, Deprecation, Archival, Authorization.

## Terminology Strengths
- Core terms appear consistently in package manifests and architecture tables.
- Certification and remediation chain terms preserve historical context.

## Terminology Conflicts
1. Status and disposition vocabulary is over-fragmented in ARCHITECTURE_MANIFEST.
   - Extracted unique status values: 51.
   - Includes mixed case and mixed semantic granularity (for example: Approved, Complete, Completed, EXECUTED, IMPLEMENTED, Not explicitly declared, Unknown).
2. Multiple semantically similar terms are used as if lifecycle states and quality states are equivalent.

## Owner and Definition Coherence
- Primary owner for terminology normalization appears to be Architecture Governance, but a strict canonical state taxonomy is not enforced uniformly.

## Result
MAJOR finding recorded (FR-003).