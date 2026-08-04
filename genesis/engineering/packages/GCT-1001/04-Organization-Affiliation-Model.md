# 04 Organization Affiliation Model

## Authority
Organization remains authoritative owner of organizations. Contact consumes organization existence checks and does not mutate organization state.

## Affiliation Rules
- Affiliation add requires:
  - contact exists
  - tenant match
  - organization existence for tenant
- Duplicate active role+organization affiliations are rejected.
- Primary affiliation selection clears prior primary flags.
- Affiliation end writes effective end timestamp and audit event.

## Integrity Constraints
- Cross-tenant affiliation is rejected at service boundary and persistence validation.
- Recovery rejects corrupt state containing cross-tenant affiliation records.
