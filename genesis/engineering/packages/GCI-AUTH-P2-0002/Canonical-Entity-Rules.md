# Canonical Entity Rules

Canonical entity handling must obey deterministic rules:
- identical inputs and versions produce identical outputs;
- canonical serialization and SHA-256 identity derivation are stable;
- candidate ordering is deterministic;
- alias ordering is deterministic;
- conflicting observations are preserved, not erased;
- unresolved identity remains unresolved;
- supersedence and retirement create new versions rather than mutating prior records.

The runtime may represent governed entity classes such as Organization, Person, Product, Service, Asset, Facility, Document, Project, or System, but the authorization does not require all classes in the first implementation slice.