# 07 Discovery Architecture

## Discovery Scope
1. Repository roots.
2. Program and package directories.
3. Registry directories.
4. Manifest artifacts.
5. Validation, certification, traceability, and release artifacts.
6. JSON and markdown control artifacts.
7. Future approved metadata formats.

## Discovery Flow
1. Discover repositories and normalize roots.
2. Discover candidate packages by manifest signature and naming contracts.
3. Discover candidate artifacts and classify by type and authority tier.
4. Build discovery index with path, hash, lifecycle, and authority metadata.

## Non-Hardcoded Rule
1. No static package allowlist is required for discovery.
2. Discovery uses manifest contracts, identifier contracts, and registry anchors.

## Exceptional Conditions
1. Missing manifest: emit error diagnostic and mark package unresolved.
2. Duplicate package identifier: emit fatal diagnostic if both are authoritative candidates.
3. Invalid JSON: emit error diagnostic and exclude artifact from authoritative extraction.
4. Broken paths: emit warning or error based on evidence tier and dependency criticality.
5. Archived or superseded packages: retain for lineage, exclude from active graph by lifecycle policy.
6. Untracked/generated/temporary artifacts: exclude by policy unless explicitly certified.
7. Multi-repository inputs: isolate provenance by repository identifier and normalize path namespace.
