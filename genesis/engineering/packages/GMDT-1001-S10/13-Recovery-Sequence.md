# 13 Recovery Sequence

Runtime integration sequence:
- 09g registers observability/reference services
- 09h initializes persistence and recovery
- load manifest and tenant partitions
- validate schema and structural envelope
- validate domain invariants and reference policy
- hydrate canonical service state
- rebuild projections and recompute persistence-aware metrics/health
- register persistence service
- proceed to required-registration validation and READY

Blocking recovery failures prevent READY.
