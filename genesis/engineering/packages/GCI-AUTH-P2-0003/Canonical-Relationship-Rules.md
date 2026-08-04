# Canonical Relationship Rules

Canonical relationship handling must obey deterministic rules:
- identical inputs and versions produce identical outputs;
- canonical serialization and SHA-256 identity derivation are stable;
- relationship ordering is deterministic;
- directionality and cardinality encoding are deterministic;
- contradictory relationships are preserved and never silently resolved;
- contradictory relationships remain deterministic under identical inputs;
- contradictory relationship provenance is retained in immutable form;
- downstream runtime layers decide contradiction resolution, not Relationship Runtime;
- unresolved relationships remain unresolved;
- relationship provenance is immutable;
- relationship lineage is append-only;
- supersedence and retirement create new versions rather than mutating prior records.

The runtime may represent governed relationship classes such as parent/child, ownership, membership, containment, dependency, reference, association, control, participation, affiliation, responsibility, and flow as first-class constitutional concepts, but authorization does not require all classes in the first implementation slice.
