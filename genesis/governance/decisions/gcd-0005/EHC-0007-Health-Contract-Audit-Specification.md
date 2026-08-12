# EHC-0007 Health Contract Audit Specification

Artifact ID: EHC-0007
Decision Parent: GCD-0005
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Audit and Governance Authority
Owner: Enterprise Audit Governance

## Purpose

Define immutable audit requirements for health and capability contract changes.

## Required Audit Event Fields

Every contract mutation SHALL record:
- timestamp
- authority
- previousContractVersion
- newContractVersion
- reason
- approvalReference
- compatibilityImpact

## Additional Required Fields

- applicationId
- actor
- lifecycleStateBefore
- lifecycleStateAfter
- statusBefore
- statusAfter

## Audit Rules

1. Audit records are append-only.
2. Audit records are immutable after publication.
3. Breaking contract version changes require explicit approvalReference.
4. compatibilityImpact is mandatory for MAJOR and MINOR version changes.
