# EAR-0003 Application Registration Lifecycle Specification

Artifact ID: EAR-0003
Decision Parent: GCD-0004
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Architecture and Runtime Authority

## Purpose

Define the lifecycle states and transition law for Enterprise Application Registry records.

## Lifecycle States

- Draft
- Proposed
- Under Review
- Approved
- Registered
- Active
- Deprecated
- Retired
- Archived

## Transition Rules

Allowed transitions:
- Draft -> Proposed
- Proposed -> Under Review
- Under Review -> Approved
- Under Review -> Draft
- Approved -> Registered
- Registered -> Active
- Active -> Deprecated
- Deprecated -> Retired
- Retired -> Archived

Conditional transitions:
- Active -> Under Review (major contract or ownership change)
- Deprecated -> Active (re-activation only with full revalidation)

Forbidden transitions:
- Draft -> Active
- Proposed -> Active
- Under Review -> Active
- Active -> Registered
- Archived -> Active

## Lifecycle Governance Rules

1. Every transition SHALL record actor, authority, reason, and approval record.
2. Approval is mandatory before Registered and Active states.
3. Retired and Archived states are append-preserving and auditable.
4. Lifecycle state SHALL remain synchronized with validation and audit status.
