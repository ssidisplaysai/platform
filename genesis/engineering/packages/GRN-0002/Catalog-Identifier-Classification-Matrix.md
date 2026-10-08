# Catalog Identifier Classification Matrix

## Classification Legend
- VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY
- GOVERNANCE_DOCUMENTATION_ARTIFACT_NOT_PACKAGE_ROOT
- REGISTRY_TOKEN_NOT_PACKAGE_ROOT
- REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT
- APPROVED_VISION_PACKAGE_PENDING_INTEGRATION

## Proposed Vision Package Classifications

These deterministic classifications are approved with conditions by `ARD-0002` but are not active. They become effective only after remaining required reviews, approved taxonomy integration, and custody integration of the referenced package paths. Until then, current `origin/main` classification remains authoritative.

| Identifier | Intended path | Constitutional catalog presence | Custody state | Artifact type | Proposed representation | Proposed classification | Parity treatment if approved | Authority effect |
|---|---|---|---|---|---|---|---|---|
| GPW-1001 | genesis/engineering/packages/GPW-1001 | absent | pending custody integration | workspace vision | non-constitutional vision package | APPROVED_VISION_PACKAGE_PENDING_INTEGRATION | exclude from constitutional package-root parity | no engineering, runtime, lifecycle-promotion, or constitutional authority |
| GPW-1002 | genesis/engineering/packages/GPW-1002 | absent | pending custody integration | workspace vision | non-constitutional vision package | APPROVED_VISION_PACKAGE_PENDING_INTEGRATION | exclude from constitutional package-root parity | no engineering, runtime, lifecycle-promotion, or constitutional authority |
| GPW-1003 | genesis/engineering/packages/GPW-1003 | absent | pending custody integration | workspace vision | non-constitutional vision package | APPROVED_VISION_PACKAGE_PENDING_INTEGRATION | exclude from constitutional package-root parity | no engineering, runtime, lifecycle-promotion, or constitutional authority |

## Missing Registrations
| Identifier | Observed path | Catalog presence | Package-root presence | Artifact type | Expected representation | Classification | Recommended correction | Evidence |
|---|---|---|---|---|---|---|---|---|
| GCF-1.1 | genesis/engineering/packages/GCF-1.1 | absent | present | constitutional foundation release | package-root catalog row | VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY | add canonical catalog row | README.md and LIFECYCLE-METADATA.md present |
| GCI-AUTH-P2-0001 | genesis/engineering/packages/GCI-AUTH-P2-0001 | absent | present | authorization package | package-root catalog row | VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY | add canonical catalog row | README.md and LIFECYCLE-METADATA.md present |
| GCI-AUTH-P2-0003 | genesis/engineering/packages/GCI-AUTH-P2-0003 | absent | present | authorization package | package-root catalog row | VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY | add canonical catalog row | README.md and LIFECYCLE-METADATA.md present |
| GCI-P1-0004 | genesis/engineering/packages/GCI-P1-0004 | absent | present | implementation package | package-root catalog row | VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY | add canonical catalog row | README.md and LIFECYCLE-METADATA.md present |
| GCI-P1-0005 | genesis/engineering/packages/GCI-P1-0005 | absent | present | implementation package | package-root catalog row | VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY | add canonical catalog row | README.md and LIFECYCLE-METADATA.md present |
| GCI-P2-0000 | genesis/engineering/packages/GCI-P2-0000 | absent | present | constitutional architecture | package-root catalog row | VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY | add canonical catalog row | README.md and LIFECYCLE-METADATA.md present |
| GCI-P2-0001 | genesis/engineering/packages/GCI-P2-0001 | absent | present | implementation package | package-root catalog row | VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY | add canonical catalog row | README.md and LIFECYCLE-METADATA.md present |
| GCI-P2-0002 | genesis/engineering/packages/GCI-P2-0002 | absent | present | implementation package | package-root catalog row | VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY | add canonical catalog row | README.md and LIFECYCLE-METADATA.md present |

## Non-Package Identifiers
| Identifier | Observed path | Catalog presence | Package-root presence | Artifact type | Expected representation | Classification | Recommended correction | Evidence |
|---|---|---|---|---|---|---|---|---|
| GCI-0001 | none | present | absent | registry token | governance reference only | REGISTRY_TOKEN_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and phase-chain provenance |
| GCI-P1-0002A | none | present | absent | governance documentation artifact | governance reference only | GOVERNANCE_DOCUMENTATION_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | documentation index and lifecycle references |
| WS-II | none | present | absent | reference stub | governance reference only | REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and stub README |
| WS-III | none | present | absent | reference stub | governance reference only | REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and stub README |
| WS-IIIA | none | present | absent | reference stub | governance reference only | REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and stub README |
| WS-IIIA-R1 | none | present | absent | reference stub | governance reference only | REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and stub README |
| WS-IIIB | none | present | absent | reference stub | governance reference only | REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and stub README |
| WS-IIIC | none | present | absent | reference stub | governance reference only | REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and stub README |
| WS-IIID | none | present | absent | reference stub | governance reference only | REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and stub README |
| WS-IIIE | none | present | absent | reference stub | governance reference only | REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT | retain in catalog, exclude from package-root parity | catalog row and stub README |