# EHC-0006 Enterprise Observability Specification

Artifact ID: EHC-0006
Decision Parent: GCD-0005
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Enterprise Operating System Governance
Owner: Enterprise Observability Governance

## Purpose

Define the enterprise-level observability aggregation surface that Genesis may derive from health and capability contracts.

## Allowed Aggregation

Genesis may aggregate:
- health status
- readiness
- liveness
- lifecycleState
- applicationVersion
- contractVersion
- capability declarations
- compatibilityStatus
- deploymentRevision
- buildIdentifier
- registeredServices
- dependencies
- ownerAuthority
- lastSuccessfulHealthCheck
- lastUpdated

## Explicitly Prohibited Aggregation

Genesis SHALL NOT aggregate or require through this contract:
- business metrics
- customer information
- application-owned operational internals beyond declared contract fields
- secrets
- credentials
- internal implementation details

## Boundary Rule

Observability aggregation does not transfer business-domain authority from applications to Genesis.
