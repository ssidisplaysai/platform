# GACD-0002 Genesis Dependency Policy

Decision ID: GACD-0002
Program: Genesis Stabilization Program
Package: GACD-0002
Type: Constitutional Engineering Decision
Status: CERTIFIED
Date: 2026-07-28
Evidence Package: GACI-0002
Owner: Genesis Architecture and Runtime Authority
Approval: APPROVED
Supersedes: None
Superseded By: None

## 1. Executive Summary
This package establishes the permanent constitutional dependency policy for the Genesis Enterprise Operating System.

The policy is based on certified evidence from GACI-0002 and is governance-only. It introduces no implementation changes.

Certified baseline observations:
- Dependency direction is largely correct.
- Platform-to-Application dependencies are not present.
- Runtime-to-Application dependencies are not present.
- Most reported violations are intentional exceptions or analysis artifacts.
- Remaining architectural debt is concentrated in production application-to-implementation shortcuts and selected upward dependencies.

## 2. Purpose
This decision defines the authoritative dependency policy that governs all future engineering work in Genesis.

The policy defines:
- Valid dependency directions
- Invalid dependency directions
- Constitutional exceptions
- Architectural debt classification
- Enforcement expectations
- Review criteria

## 3. Constitutional Dependency Law
Genesis SHALL maintain directed architectural dependencies.

Dependencies SHALL flow only toward lower architectural layers unless explicitly approved by constitutional policy.

No team, package, or runtime surface may redefine this law without a successor constitutional decision.

## 4. Architectural Layers
Canonical layer order for dependency direction:

Applications

v

Business Capabilities

v

Platform Services

v

Authoritative Runtime

v

Infrastructure

## 5. Allowed Dependencies
The following dependency directions are constitutionally allowed:

- Applications -> Business Capabilities
- Business Capabilities -> Platform Services
- Platform Services -> Runtime
- Runtime -> Infrastructure
- Approved abstractions
- Approved public contracts
- Approved dependency inversion

## 6. Prohibited Dependencies
The following dependency patterns are constitutionally prohibited unless explicitly certified as exceptions:

- Application -> Runtime Internals
- Application -> Platform Internals
- Platform -> Application
- Runtime -> Application
- Domain -> Unauthorized Platform Internals
- Cross-domain implementation shortcuts
- Circular dependency creation
- Bypassing certified public contracts

## 7. Constitutional Exceptions
The following SHALL NOT be considered architectural violations when properly documented, bounded, and approved:

- Protected authorization seams
- Approved security boundaries
- Approved dependency inversion
- Testing infrastructure
- Compiler tooling
- Simulation tooling
- Generated analysis artifacts
- Certified architectural exceptions

Exception governance requirements:
- Exception scope SHALL be explicit.
- Exception owner SHALL be named.
- Exception rationale SHALL reference governing evidence.
- Exception SHALL be re-validated in future GAR cycles.

## 8. Architectural Debt Classification
Every dependency issue SHALL receive exactly one classification:

- VALID
- INTENTIONAL
- TRANSITIONAL
- ARCHITECTURAL DEBT
- FALSE POSITIVE

Classification rules:
- VALID: conforms to allowed direction and approved contract boundaries.
- INTENTIONAL: exception is documented and constitutionally approved.
- TRANSITIONAL: temporary deviation with approved convergence plan.
- ARCHITECTURAL DEBT: non-approved deviation requiring convergence action.
- FALSE POSITIVE: analysis artifact or non-actionable signal.

## 9. Engineering Review Rules
Every dependency review SHALL determine:

- Direction
- Authority
- Classification
- Priority
- Disposition

Disposition values:
- PRESERVE
- CLARIFY
- CONSOLIDATE
- RELOCATE
- RETIRE
- INVESTIGATE

## 10. Dependency Metrics
The following metrics SHALL be tracked continuously:

- Upward dependencies
- Circular dependencies
- Cross-domain dependencies
- Application-to-implementation shortcuts
- Dependency-policy exceptions
- False-positive rate

Metric governance:
- Metrics SHALL be baselined per GAR package.
- Trends SHALL be reviewed for convergence quality, not raw volume only.

## 11. Continuous Enforcement
Future GAR reviews SHALL evaluate dependency direction using this policy.

Every convergence package SHALL reduce architectural debt or improve evidence quality.

Enforcement expectations:
- New prohibited dependencies SHALL trigger review and disposition.
- Exception growth without documented authority SHALL be treated as governance non-conformance.
- Debt remediation SHALL be prioritized by production risk and boundary impact.

## 12. Decision Metadata
- Decision ID: GACD-0002
- Status: CERTIFIED
- Evidence: GACI-0002 and GAR-0002 evidence set
- Approval: APPROVED
- Owner: Genesis Architecture and Runtime Authority
- Supersedes: None
- Superseded By: None

## Validation Record
- No implementation files modified: VERIFIED
- Governance/documentation-only mutation: VERIFIED
- Registry consistency: VERIFIED
- Cross-reference validity: VERIFIED
