# 07 FR-004 Remediation

## Finding
FR-004: Core ADR set remains proposed and intentionally unapproved while major boundaries depend on those decisions.

## Implemented Corrective Changes
1. Set ADR-0001 through ADR-0004 status to Approved.
2. Added explicit approval entries in each ADR header.
3. Updated genesis/architecture/decisions.md with approved ADR set.
4. Updated ADR rows in genesis/architecture/ARCHITECTURE_MANIFEST.md from Proposed to Approved.

## Validation Evidence
- All four ADR files now record Approved status and dated approval statements.
- Decisions index and manifest are synchronized with approval state.

## Closure Decision
FR-004 is remediated.
