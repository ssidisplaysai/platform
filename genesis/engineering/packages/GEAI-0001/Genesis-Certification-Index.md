# Genesis Certification Index

## Certification Index Scope
This index references certification-oriented packages that are auditable in the current local governance baseline.

Scope rule:
- Primary certification registry entries must resolve to local package roots under genesis/engineering/packages.
- Historical or external lineage references that are not materialized locally are recorded separately as informational lineage and are excluded from local auditability scoring.

## Certification Packages (Local Auditable Baseline)
| Package | Certification Scope | Baseline Reference | Auditability Status |
|---|---|---|---|
| GCP-0002H-A | Quote foundation certification | Commerce quote certification | Auditable |
| GCP-0002I-A | Sales order foundation certification | Commerce sales-order certification | Auditable |
| GMP-0002A | Work order foundation certification | Manufacturing work-order certification | Auditable |
| GMP-0003A | Production job foundation certification | Manufacturing production-job certification | Auditable |
| GMP-0006A | Scheduling foundation certification | Manufacturing scheduling certification | Auditable |
| GMP-0008B | Manufacturing execution foundation certification | Manufacturing execution baseline | Auditable |

## Version 1.0 Required Certification Scope
| Package | Requirement | Current Status |
|---|---|---|
| GCP-0002H-A | Required for Version 1.0 promotion scope | CERTIFIED |
| GCP-0002I-A | Required for Version 1.0 promotion scope | CERTIFIED |
| GMP-0002A | Required for Version 1.0 promotion scope | CERTIFIED |
| GMP-0003A | Required for Version 1.0 promotion scope | CERTIFIED |
| GMP-0006A | Required for Version 1.0 promotion scope | CERTIFIED |
| GMP-0008B | Required for Version 1.0 promotion scope | CERTIFIED |

## Informational Lineage (Not Materialized In Current Local Baseline)
- GKF-PKG-0001B
- GARR-0001B
- GCDM-0001A
- GBG-0002A
- GBG-0003A
- GBG-0003C
- GBG-0003E
- GBG-0003G
- GMK-I007A
- GEAA-0001 (approval recommendation, not certification package)
- GEAS-0001 (approval recommendation, not certification package)

## Certification Navigation
- Local auditable certification roots: GCP and GMP families
- Historical lineage families: GKF-PKG, GARR, GBG, GMK, GCDM

## Certification Integrity Rule
Certification packages must map to at least one governing constitutional package and one implementation or architecture scope.

Additional local auditability rule:
- Packages listed as local auditable must exist in the constitutional package catalog and local package roots.

## Cross-References
- Genesis-Constitutional-Package-Catalog.md
- Genesis-Implementation-Relationship-Map.md
- Genesis-Audit-Index.md
- genesis/engineering/packages/GRP-0001/Genesis-Certification-Auditability-Report.md
