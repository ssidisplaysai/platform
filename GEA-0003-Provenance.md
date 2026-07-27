# GEA-0003 Provenance

Each context section reference stores provenance:
- sourceId and sourceVersion
- artifactId
- timestamp
- workspaceId and optional projectId
- registryIdentity
- validationState

Provenance is exposed by GET /api/gea/context/provenance and is derived from immutable memory references and section assembly.
