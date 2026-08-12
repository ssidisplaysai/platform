# Enterprise Health Contract Proposal

Artifact ID: GCD-0003-EHC-0001
Decision Parent: GCD-0003
Status: PROPOSED
Lifecycle State: Draft
Authority: Genesis Architecture and Runtime Authority
Owner: Enterprise Observability Governance

## Purpose

Define the minimum health contract every Genesis-registered application SHALL expose for enterprise health aggregation.

## Constitutional Contract

Every registered application SHALL expose one governed health endpoint conforming to this contract.

Genesis SHALL aggregate health but SHALL NOT absorb application runtime ownership.

## Minimum Contract Fields

- applicationId
- applicationName
- version
- status
- runtime
- health
- capabilities
- deploymentRevision
- contractVersion
- lastSeen
- registeredServices
- genesisCompatibilityVersion
- authorityOwner

## Field Semantics

- status: declared operational state from application owner.
- health: current health posture and readiness signal.
- runtime: runtime family and runtime version metadata.
- capabilities: currently enabled capability declarations.
- authorityOwner: accountable owner for health semantics.

## Validation Rules

1. contractVersion is mandatory.
2. applicationId and applicationName must match Enterprise Application Registry identity.
3. authorityOwner must match registry authority ownership declaration.
4. status and health values must conform to approved enum vocabulary.
5. lastSeen must be monotonic per reporting policy.
6. incompatible genesisCompatibilityVersion SHALL trigger compatibility alerts.

## Explicit Exclusions

This contract SHALL NOT include:
- application secrets
- internal stack traces as mandatory fields
- private customer data
- constitutional publication metadata

## Governance Relationship

This health contract is an operational contract governed by GCD-0003 boundaries and registry authority policy.

It does not redefine Constitutional Registry semantics.
