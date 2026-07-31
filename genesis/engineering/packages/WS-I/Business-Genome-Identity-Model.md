# Business Genome Identity Model

## Identity Mission
Define deterministic and collision-resistant identity contracts for canonical Business Genome objects.

## Identity Domains
- enterprise domain
- organization domain
- business object domain
- relationship domain
- evidence domain
- provenance domain

## Identity Components
- namespace
- authorityScope
- objectType
- stableBusinessKey
- versionQualifier
- checksum

## Identity Generation Rule
Canonical identity is generated from normalized identity components in deterministic order. Identical normalized inputs always produce identical identities.

## Identity Constraints
1. Namespace is mandatory and immutable.
2. Stable business key cannot encode transient state.
3. Version qualifier must map to versioning model semantics.
4. Identity collision resolution is deterministic and policy-governed.
5. Human-readable aliases are non-authoritative.

## Reserved Identity Prefixes
- ORG-
- PROD-
- SERV-
- CUST-
- VEND-
- EMPL-
- ROLE-
- ASST-
- FAC-
- DOC-
- POL-
- PROC-
- CAP-
- REL-
- EVD-
- PRV-

## Cross-References
- Business-Genome-Entity-Model.md
- Business-Genome-Relationship-Model.md
- Business-Genome-Versioning-Model.md
- Business-Genome-Invariants.md
