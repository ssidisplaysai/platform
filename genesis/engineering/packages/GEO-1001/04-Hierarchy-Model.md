# 04 Hierarchy Model

Hierarchy entities:
- HierarchyNode
- parentOrganizationId
- childOrganizationIds
- depth
- path

Behavior:
- Node upsert computes deterministic depth and path.
- Parent-child linkage maintained in hierarchy updates.
- Hierarchy state persisted as part of organization platform state.
