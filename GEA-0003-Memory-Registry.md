# GEA-0003 Memory Registry

## Purpose
Provide a canonical registry for enterprise memory references with immutable lineage metadata.

## Runtime Components
- createMemoryRegistryService
- createMemoryResolver
- createMemoryCatalog

## Registry Contracts
- MemorySource: authoritative source details and version.
- MemoryVersion: stable checksum for reference versioning.
- MemoryReference: identity, source, permissions, authority state.
- MemoryCollection and MemorySnapshot: deterministic grouping and capture.

## Enforcement
- Default deny for cross-workspace and cross-organization references.
- Optional project isolation checks.
- Capability and action permission checks for protected references.
- Authoritative and non-UNVERIFIED references required by policy.
