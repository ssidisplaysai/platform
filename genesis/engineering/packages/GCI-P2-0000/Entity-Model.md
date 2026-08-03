# Entity Model

## Canonical Entity Classes
Company, Division, Department, Employee, Role, Customer, Vendor, Supplier, Partner, Product, Service, Asset, Facility, Policy, Process, Document, Application, System, Dataset, Project, Team, Capability.

## Entity Contract
Each entity includes:
- deterministic identity
- semantic class
- canonical attributes
- ownership reference
- confidence/trust context
- lineage reference
- version metadata

## Entity Invariants
- Entity identity is deterministic.
- Entity versions are immutable.
- Attribute evolution is versioned with supersedence.
- Ownership is explicit and auditable.