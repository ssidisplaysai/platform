# Parity Calculation Rules

## Sets
- PACKAGE_ROOT_IDENTIFIERS: canonical package-root directories under genesis/engineering/packages.
- PACKAGE_ROOT_CATALOG_IDENTIFIERS: catalog rows classified as PACKAGE_ROOT.
- NON_PACKAGE_GOVERNANCE_IDENTIFIERS: registry tokens, reference stubs, and governance-only non-root artifacts.
- SPECIFICATION_IDENTIFIERS: constitutional and specification documents that are not package roots.
- REGISTRY_REFERENCE_IDENTIFIERS: registry tokens preserved for governance continuity.
- UNRESOLVED_IDENTIFIERS: identifiers without a conclusive canonical classification.

## Formula
Package parity MUST be computed as:

PACKAGE_ROOT_IDENTIFIERS minus PACKAGE_ROOT_CATALOG_IDENTIFIERS

Only this difference defines missing package registrations or orphan package registrations.

## Exclusions
- Registry tokens are excluded from package-root parity.
- Reference stubs are excluded from package-root parity.
- Governance documentation artifacts are excluded from package-root parity.
- Specification identifiers are excluded from package-root parity.

## Required Reporting
- Package roots
- Package-root catalog identifiers
- Missing package registrations
- Orphan package registrations
- Non-package governance identifiers
- Unresolved identifiers
- Duplicate identifiers