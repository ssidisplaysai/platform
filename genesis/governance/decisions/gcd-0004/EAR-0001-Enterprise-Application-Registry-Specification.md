# EAR-0001 Enterprise Application Registry Specification

Artifact ID: EAR-0001
Decision Parent: GCD-0004
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Architecture and Runtime Authority
Owner: Enterprise Operating System Governance

## Purpose

Define the authoritative application record contract and governance semantics for the Enterprise Application Registry.

## Constitutional Boundary

The Enterprise Application Registry is an operational governance registry.

It is not a Constitutional Registry and does not govern constitutional artifact publication standing.

## Required Application Record Schema

Each application record SHALL include:
- applicationId
- applicationName
- displayName
- company
- ownerAuthority
- status
- lifecycleState
- publicUrl
- launchUrl
- healthEndpoint
- capabilities
- permissions
- supportedGenesisVersion
- applicationVersion
- contractVersion
- dependencies
- repositoryIdentifier
- deploymentIdentifier
- primaryContacts
- createdDate
- lastUpdated
- retirementDate
- auditHistoryReference

## Field Semantics

- applicationId: immutable unique identity key.
- ownerAuthority: single accountable authority owner for record governance.
- lifecycleState: governed state from EAR-0003.
- launchUrl: canonical launch target consumed by Genesis navigation.
- healthEndpoint: canonical health contract endpoint governed by EAR-0005 and GCD-0003 EHC proposal.
- contractVersion: version of Enterprise Application Contract conformance.
- auditHistoryReference: immutable pointer to mutation event lineage.

## Explicit Exclusions

Records SHALL NOT store:
- business transactions
- customer records
- raw runtime telemetry state
- secrets
- credentials
- private infrastructure keys

## Relationship to Adjacent Artifacts

- Compatible with GCD-0003 application boundary doctrine.
- Compatible with Enterprise Health Contract proposal.
- Compatible with Enterprise Application Contract proposal.
- Compatible with GACD-0005 single-authority registry law.
