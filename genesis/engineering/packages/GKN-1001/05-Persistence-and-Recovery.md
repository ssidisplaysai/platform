# 05 Persistence and Recovery

Persistence model:

1. FileKnowledgeStore persists canonical state to file.knowledge-state.v1.
2. PersistenceCoordinator validates schema and uniqueness constraints on load and mutation.
3. Save operations are lock-serialized for deterministic write behavior.

Recovery model:

1. Missing state file initializes deterministic default state.
2. Corrupt or unsupported state fails closed through KnowledgeError.
3. Recovery count and corrupt-state metrics are tracked for observability.
