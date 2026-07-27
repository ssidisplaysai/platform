# GEA-0003 Context Builder

## Pipeline
1. Resolve requested references from registry.
2. Apply authorization filter (default deny).
3. Deterministically deduplicate and order references.
4. Build sections grouped by source type.
5. Assemble dependency graph and package metadata.
6. Compute package checksum and cache key.
7. Persist package, validation record, cache entry, and health snapshot.

## Determinism
- Sorted source groups and stable reference keys.
- Stable checksum over canonical context payload.
- Replay checksum computed from the same canonical payload.

## Caching
- Cache key includes workspace, project, policy version, references, and source versions.
- Active cache entries return context with incremented hit count and last-hit timestamp.
