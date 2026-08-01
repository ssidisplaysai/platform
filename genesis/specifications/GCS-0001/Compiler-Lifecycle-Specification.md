# Compiler Lifecycle Specification

## 1. Normative Lifecycle States
A conforming compiler lifecycle MUST define and preserve the following states:
- DECLARED
- READY
- EXECUTING
- COMPLETED
- FAILED
- REPLAYED
- CERTIFIED
- ARCHIVED

## 2. Normative Transition Rules
- READY MUST require complete required inputs and manifests.
- EXECUTING MUST require immutable lifecycle context lock.
- COMPLETED MUST require all required outputs and manifests.
- FAILED MUST preserve diagnostics, lineage, and partial immutable artifacts.
- REPLAYED MUST preserve linkage to prior execution identifiers.
- CERTIFIED MUST require certification decision under Certification-Specification.md.
- ARCHIVED MUST preserve historical immutability and retrievability.

## 3. Normative Lifecycle Invariants
- Lifecycle transitions MUST be append-only.
- Historical lifecycle records SHALL NOT be deleted or overwritten.
- Lifecycle decisions MUST be auditable and replay-traceable.

## Informative Guidance
Lifecycle gates are implementation-independent state contracts, not runtime mechanisms.
