# Genesis Commerce Versioning Strategy

## Version Model
Every contract uses semantic versioning:
1. major
2. minor
3. patch

## Increment Rules
1. Major
- Breaking schema or semantic changes.
- Field removals, renames, or behavior redefinition.

2. Minor
- Backward-compatible field additions.
- New optional metadata.
- Additional event or command families that do not break existing contracts.

3. Patch
- Non-semantic corrections.
- Clarification updates with no payload or behavior incompatibility.

## Compatibility Guarantees
1. Consumers must validate major version compatibility.
2. Consumers should tolerate higher minor versions when unknown fields are ignorable.
3. Producers must preserve old major streams until retirement policy is completed.

## Deprecation Policy
1. Contract deprecation must be announced with timeline.
2. Parallel publication supports migration windows.
3. Removal of deprecated major versions requires explicit governance approval.

## Governance Requirement
Breaking changes require new major versions and migration documentation.
