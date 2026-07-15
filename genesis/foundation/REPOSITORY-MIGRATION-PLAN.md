# Repository Migration Plan (GRC-0001)

Status: Draft Plan
Date: 2026-07-15
Scope: Canonicalization of engineering package and archive locations.

## Canonical Target

Canonical engineering root: genesis/engineering

## Current Split

- docs/engineering contains GCS-0001 package and archive.
- genesis/engineering contains GEP-0001 and GSG-0001 packages and archives.

## Migration Phases

### Phase 1: Registry and Metadata Normalization

- Complete baseline registry publication.
- Normalize package metadata keys across all package manifests.
- Align lifecycle statuses between specification and package metadata.

### Phase 2: Path Canonicalization

- Copy docs/engineering/packages/GCS-0001 to genesis/engineering/packages/GCS-0001.
- Copy docs/engineering/downloads/GCS-0001-engineering-package.zip to genesis/engineering/downloads/.
- Preserve original docs/engineering paths during compatibility window.

### Phase 3: Compatibility and Verification

- Add README notices under docs/engineering pointing to canonical genesis/engineering paths.
- Verify package metadata, archive metadata, and registry links resolve to canonical paths.
- Re-run archive open/integrity checks.

### Phase 4: Legacy Path Decommission (Later)

- Deprecate docs/engineering once all tooling and references consume genesis/engineering.
- Remove duplicate legacy copies after a controlled deprecation period.

## Non-Goals

- No architecture redesign.
- No normative specification rewrites.
- No compiler implementation changes.
