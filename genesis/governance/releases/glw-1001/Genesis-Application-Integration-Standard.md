# Genesis Application Integration Standard (GLW-1001 Reference)

## Purpose
Define the standard integration contract for enterprise applications entering Genesis.

## Standard Rules
1. Application identity, lifecycle, launch metadata, capabilities, and ownership must be registered through EAR.
2. Enterprise health, readiness, liveness, and compatibility must be evaluated through EHC.
3. Discovery, dashboard aggregation, navigation, and launch policy must be provided through GMC.
4. Applications must not duplicate platform system-of-record responsibilities.
5. Platform services must not absorb business domain ownership from applications.

## Required Metadata
- Application ID
- Code
- Display Name
- Description
- Lifecycle State
- Launch metadata
- Capabilities
- Health references
- Version
- Contract compatibility
- Ownership and contact metadata

## Compliance Gate
An application is integration-compliant when:
1. It is discoverable in GMC via EAR data.
2. Its health and compatibility are visible in EHC outputs.
3. Its launch behavior is controlled by GMC policy.
4. Boundary verification shows no ownership leakage.
