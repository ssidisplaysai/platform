# EHC-0002 Capability Advertisement Specification

Artifact ID: EHC-0002
Decision Parent: GCD-0005
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Architecture and Runtime Authority
Owner: Capability Governance

## Purpose

Define constitutional rules for capability advertisement across registered applications.

## Capability Declaration Model

Each capability declaration SHALL include:
- capabilityId
- capabilityName
- capabilityVersion
- capabilityStatus
- lifecycleState
- compatibilityMarkers
- ownerAuthority
- deprecationPolicy

## Canonical Capability Families

- content-generation
- seo-publishing
- inventory
- crm
- manufacturing
- accounting
- ai
- workflow-automation
- reporting
- plugins

## Capability Rules

1. capabilityId SHALL be stable and unique within application scope.
2. capabilityVersion SHALL follow semantic versioning.
3. capabilityStatus SHALL align with application lifecycle and readiness.
4. capability deprecation SHALL include migration notice metadata.
5. capability discovery SHALL be contract-based through EHC-0001 payload.

## Capability Lifecycle

- Proposed
- Active
- Deprecated
- Retired

Deprecated capabilities SHALL remain discoverable for compatibility windows until retired.
