# 09 Canonical State Durability

Durability approach:
- top-level command entrypoints are wrapped by the persistence coordinator
- successful canonical mutations must save durable state before success is considered complete
- if required durable save fails after mutation, in-memory state is rolled back to the prior envelope and PERSISTENCE_WRITE_FAILURE is raised
- if a failing command mutated canonical reconciliation state before throwing, the changed post-failure state is durably saved and the original domain error is preserved
