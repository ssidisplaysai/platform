# 12 Recovery Sequence

Startup recovery loads the manifest, validates the schema, loads tenant partitions, validates invariants, restores the service graph, and only then allows READY.

This ordering keeps recovery deterministic and fail-closed.