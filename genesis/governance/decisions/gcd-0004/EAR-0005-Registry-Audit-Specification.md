# EAR-0005 Registry Audit Specification

Artifact ID: EAR-0005
Decision Parent: GCD-0004
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Audit and Governance Authority

## Purpose

Define immutable audit requirements for all Enterprise Application Registry mutations.

## Immutable Audit Event Contract

Every registry mutation SHALL record:
- timestamp
- actor
- authority
- reason
- previousValue
- newValue
- approvalRecord

## Additional Required Audit Metadata

- recordIdentifier
- mutationClass
- lifecycleStateBefore
- lifecycleStateAfter
- validationEvidenceReference

## Audit Rules

1. Audit events are append-only.
2. Audit events SHALL be immutable after publication.
3. No mutation may commit without audit event creation.
4. Approval record linkage is mandatory for approval-gated transitions.
5. Audit history SHALL remain discoverable through auditHistoryReference.
