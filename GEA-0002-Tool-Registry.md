# GEA-0002 Tool Registry

## Registry Service
Implemented by ToolRegistryService in src/lib/gea/tool-registry-service.ts.

## Responsibilities Delivered
1. Register tools with immutable contracts and execution policy.
2. Resolve tools by identifier.
3. Discover tools through searchable catalog filtering.
4. Publish new versions with compatibility checks.
5. Enable lifecycle transitions and append-only lifecycle event recording.
6. Provide built-in category catalog.

## Registration Contract
Registration requires:
1. identifier and metadata
2. category
3. capability requirements
4. permission requirements
5. input schema
6. output schema
7. validation and error contract metadata
8. timeout/retry/replay/determinism policy
9. compatibility policy

## Versioning and Contract Immutability
1. Each version stores input/output contract checksums.
2. Strict compatibility blocks contract checksum drift across versions.
3. Validation history and policy history are persisted for each published version.

## Persistence
Registry metadata is persisted via GeaToolDefinition and related history models in Prisma.
