# 01 Integrated Implementation Inventory

Implementation surfaces under src/platform/inventory:
- contracts: complete typed contracts and failure-classification taxonomy
- domain: identifiers, value objects, lifecycle, invariants, deterministic helpers, domain error model
- runtime: lifecycle host composition, provider/service registration, singleton guards, startup/stop failure handling
- integration: reference validator contracts and registry with mandatory/optional policy support
- services: foundation, movement, reservation/allocation, lot/serial/expiration, observability, persistence
- queries: foundation, movement, reservation/allocation, lot/serial/expiration, observability query surfaces
- persistence: file store, coordinator, recovery coordinator, schema, serialization, envelope/partition types
- health/metrics/audit/observation: integrated through Slice 8 observability services and read-only mission control observation

Mapping to design packages:
- GIDT-1001: domain contracts, foundation services, movement/ledger core, reservation/allocation separation
- GIDT-1001B: runtime composition boundaries, provider/service lifecycle governance, determinism and failure handling
- GIDT-1001C: observability, persistence/recovery hardening, mission-control read model, integrated readiness controls

Capability classification:
- IMPLEMENTED: all approved core Inventory platform capabilities in S1-S9 scope
- IMPLEMENTED WITH LIMITED EVIDENCE: optional external-reference validators beyond tested product/document validator doubles
- MISSING: none in approved Inventory scope
- OUT OF SCOPE: foreign platform authority domains and certification execution
