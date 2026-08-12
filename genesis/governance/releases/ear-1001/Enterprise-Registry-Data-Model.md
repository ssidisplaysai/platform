# Enterprise Registry Data Model

Work Order: EAR-1001
Date: 2026-07-30

## Primary Aggregate

EnterpriseApplication
- registration: ApplicationRegistration

ApplicationRegistration
- identity: ApplicationIdentity
- status: ApplicationStatus
- metadata: ApplicationMetadata
- capabilities: ApplicationCapabilities
- healthReference: ApplicationHealthReference
- version: ApplicationVersion
- compatibility: ApplicationCompatibility
- ownership: ApplicationOwnership
- createdAt
- updatedAt

## Identity Model

ApplicationIdentity
- applicationId
- code
- displayName

## Status Model

ApplicationStatus
- lifecycleState
- activatedAt
- deactivatedAt
- deactivationReason

Lifecycle states:
- REGISTERED
- ACTIVE
- INACTIVE
- DEPRECATED

## Metadata Model

ApplicationMetadata
- description
- tags[]
- discovery.launchPath
- discovery.baseUrl
- discovery.iconKey

## Capability Model

ApplicationCapabilities
- declared[]

## Health Reference Model

ApplicationHealthReference
- healthEndpoint
- capabilityEndpoint
- contractVersion

## Version and Compatibility Models

ApplicationVersion
- version
- releaseDate

ApplicationCompatibility
- registryContractVersion
- supportedHealthContractVersions[]
- supportedCapabilityContractVersions[]

## Ownership Model

ApplicationOwnership
- ownerOrganization
- ownerTeam
- technicalContact
- supportContact
