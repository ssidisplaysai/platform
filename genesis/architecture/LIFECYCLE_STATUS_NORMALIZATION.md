# Lifecycle Status Normalization Standard

Status: Approved
Date: 2026-07-27
Owner: Architecture Governance + Engineering Governance
Authority: GARR-0001A FR-003 remediation

## Purpose

Normalize lifecycle and status vocabulary for governance artifacts while preserving historical wording in existing records.

## Canonical Lifecycle Taxonomy

1. DECLARED
2. EXECUTED
3. IMPLEMENTED
4. VALIDATED
5. REMEDIATED
6. CERTIFIED
7. FROZEN
8. RELEASED
9. DENIED
10. BLOCKED

## Preservation Rule

1. Historical status phrases in legacy artifacts are not rewritten for meaning.
2. Legacy values must map to one canonical lifecycle state for audit interpretation.
3. Mapping is additive and does not modify historical disposition semantics.

## Normalization Mapping Guidance

- Values containing "ARCHITECTURE NOT READY" map to BLOCKED.
- Values containing "ARCHITECTURE COMPLETE" map to VALIDATED.
- Values containing "CERTIFICATION EXECUTED - NOT CERTIFIED" map to DENIED.
- Values containing "NOT CERTIFIED" map to DENIED.
- Values containing "RELEASE DENIED" map to DENIED.
- Values containing "NOT RECOMMENDED" map to DENIED.
- Values containing "READY" map to VALIDATED unless explicitly blocked.
- Values containing "IN PROGRESS" map to EXECUTED.
- Values containing "IMPLEMENTED" map to IMPLEMENTED.
- Values containing "REMEDIATED" map to REMEDIATED.

## Transition Rules

1. DECLARED -> EXECUTED -> IMPLEMENTED -> VALIDATED is the default advancement path.
2. Any state may transition to BLOCKED or DENIED when criteria fail.
3. REMEDIATED may transition to VALIDATED after evidence closure.
4. CERTIFIED, FROZEN, and RELEASED require independent governance authority and cannot be inferred from remediation packages.

## Governance Surface Application

This standard applies to interpretation of status columns in:

1. genesis/architecture/ARCHITECTURE_MANIFEST.md
2. README.md
3. STATUS.md

It does not authorize lifecycle transitions by itself.
