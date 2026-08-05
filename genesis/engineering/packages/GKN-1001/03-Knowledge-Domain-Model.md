# 03 Knowledge Domain Model

Core model entities:

1. KnowledgeRecord
- knowledge identity
- tenant scope
- metadata
- lifecycle state
- governance state
- create/update lineage

2. KnowledgeAuditRecord
- immutable audit events for platform actions.

3. KnowledgeMetrics
- deterministic counters for lifecycle, governance, and recovery state.

4. KnowledgeHealth
- observational status derived from persisted state and metrics.

Ownership model:

- Knowledge platform owns knowledge identity, metadata, lifecycle, registry, and governance state for knowledge records only.
