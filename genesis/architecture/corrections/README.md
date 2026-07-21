# Genesis Architectural Corrections

Status: Active
Classification: Genesis Standard Governance Mechanism
Type: Architectural Correction Registry

## Purpose

This directory defines the Genesis Architectural Correction Record (GACR) process and stores all approved and in-flight architectural correction records.

A GACR does not directly modify architecture.
A GACR is the constitutional governance instrument that records and governs architectural defect remediation.

## Scope

The GACR process governs:
- architectural defect discovery and formal finding capture
- authoritative root cause determination
- approved correction definition
- affected artifact revision planning
- post-revision validation and closure

The GACR process does not introduce implementation semantics.

## Canonical Lifecycle

Discovery
    ↓
Finding
    ↓
Architectural Correction Record (GACR)
    ↓
Affected Artifact Revision
    ↓
Validation
    ↓
Closure

## Governance Rules

- Source artifacts remain authoritative; findings are recorded, not hidden.
- Corrections must be traceable to explicit source evidence.
- Contract-derived defects are corrected at source contracts, never by graph inference.
- All correction records remain implementation-independent.
- A record is CLOSED only when all stated closure conditions are satisfied.

## Artifact Conventions

- File naming: GACR-XXXX-Title.md
- Sequence: monotonically increasing numerical identifier
- Status states: OPEN, APPROVED, CLOSED, SUPERSEDED
- Required evidence: explicit source artifact references and reproducible validation criteria

## Current Records

- GACR-0001: Behavioral Dependency Cycle Resolution (CLOSED)
