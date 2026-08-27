# Package Catalog Taxonomy Standard

## Candidate Effectiveness
The `VISION_PACKAGE` addition is APPROVED WITH CONDITIONS by `ARD-0002` and remains NOT EFFECTIVE. It becomes repository policy only after remaining required reviews and approved integration. Until then, the taxonomy on current `origin/main` remains authoritative, this candidate branch does not activate `VISION_PACKAGE`, and no GPW identifier receives current canonical classification.

## Taxonomy Goals
The parity model must distinguish canonical package roots from governance references that share catalog presence but do not represent package-root directories.

## Artifact Classes
- PACKAGE_ROOT: a canonical package-root directory under genesis/engineering/packages with a corresponding package registry row.
- VISION_PACKAGE: a physical, non-constitutional package directory containing non-implementation product or workspace vision material. It does not authorize engineering or runtime work, is excluded from constitutional package-root parity, does not require Constitutional Package Catalog registration solely because of its location under genesis/engineering/packages, and may be listed in the non-authoritative institutional artifact index. Promotion to another governed class requires a separate process.
- SPECIFICATION_ARTIFACT: a specification or standard document that is tracked for governance but is not itself a package root.
- REGISTRY_TOKEN: a catalog or governance identifier used as a reference token rather than a package root.
- WORKSTREAM_REFERENCE: a workstream pointer or sequencing reference that remains governance-only.
- REFERENCE_STUB: a placeholder reference package used for discoverability and taxonomy continuity.
- GOVERNANCE_ONLY_NON_ROOT: a governance package or documentation artifact that must remain in the catalog but is not counted as a package root.
- UNRESOLVED: an identifier whose canonical representation is not yet proven.

## Parity Rule
Package parity MUST compare only PACKAGE_ROOT identifiers from the catalog against actual canonical package roots on disk.

## Exclusions
Vision packages, registry tokens, reference stubs, governance-only non-root artifacts, and specifications MUST NOT be counted as orphan package registrations.

## Normalization Rule
If a catalog identifier is not a PACKAGE_ROOT, it remains valid governance evidence but is excluded from package-root parity.