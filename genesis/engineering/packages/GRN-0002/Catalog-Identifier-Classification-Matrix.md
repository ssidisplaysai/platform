# Catalog Identifier Classification Matrix

## Classification Legend
- VALID_PACKAGE_ROOT_MISSING_CATALOG_ENTRY
- GOVERNANCE_DOCUMENTATION_ARTIFACT_NOT_PACKAGE_ROOT
- REGISTRY_TOKEN_NOT_PACKAGE_ROOT
- REFERENCE_ARTIFACT_NOT_PACKAGE_ROOT

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