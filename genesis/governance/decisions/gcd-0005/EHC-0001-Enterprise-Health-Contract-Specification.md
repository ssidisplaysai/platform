# EHC-0001 Enterprise Health Contract Specification

Artifact ID: EHC-0001
Decision Parent: GCD-0005
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Architecture and Runtime Authority
Owner: Enterprise Observability Governance

## Purpose

Define the minimum constitutional health payload that every registered Genesis application SHALL expose.

## Required Schema

Every health contract payload SHALL include:
- applicationId
- applicationName
- displayName
- company
- applicationVersion
- contractVersion
- supportedGenesisVersion
- status
- lifecycleState
- readiness
- liveness
- maintenanceMode
- deploymentRevision
- buildIdentifier
- capabilities
- registeredServices
- dependencies
- compatibilityStatus
- lastSuccessfulHealthCheck
- lastUpdated
- ownerAuthority

## Contract Semantics

- status expresses overall operational posture.
- readiness expresses launch and service readiness state.
- liveness expresses process/service liveliness state.
- maintenanceMode indicates planned maintenance posture.
- compatibilityStatus expresses compatibility with current Genesis policy.

## Contract Boundary Rules

1. This contract is the maximum governance-visible operational state surface.
2. Genesis SHALL NOT require application-private internals beyond this contract.
3. Contract fields SHALL be authoritative from the application owner boundary.
