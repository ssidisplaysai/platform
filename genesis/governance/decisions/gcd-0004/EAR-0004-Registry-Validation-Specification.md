# EAR-0004 Registry Validation Specification

Artifact ID: EAR-0004
Decision Parent: GCD-0004
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Architecture and Runtime Authority

## Purpose

Define mandatory validation controls for Enterprise Application Registry records and lifecycle transitions.

## Required Validations

1. Unique applicationId.
2. Unique launchUrl.
3. Single ownerAuthority per record.
4. Valid healthEndpoint reference and contract mapping.
5. Compatible supportedGenesisVersion.
6. Valid contractVersion.
7. Dependency integrity and acyclic dependency graph.
8. Lifecycle transition validity.
9. Audit record linkage validity.

## Validation Policy

- Registration to Active states requires all critical validations passing.
- Validation failures SHALL block state transitions.
- Validation outcomes SHALL be immutable audit-linked evidence.

## Validation Severity Classes

- Blocker: identity collision, authority collision, invalid lifecycle transition.
- High: compatibility failure, invalid contract version, missing health endpoint.
- Medium: incomplete metadata fields.
- Low: non-critical descriptive metadata quality issues.
