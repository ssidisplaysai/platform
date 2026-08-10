# 12 Reconciliation Recovery

Reconciliation handling:
- reconciliation-required records remain persisted as canonical state
- recovery does not retry foreign Inventory side effects automatically
- recovered metrics and health continue to surface unresolved reconciliation state
- recovery emits audit evidence when reconciliation state is restored
