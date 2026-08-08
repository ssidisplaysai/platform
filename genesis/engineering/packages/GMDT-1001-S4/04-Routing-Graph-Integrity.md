# 04 Routing Graph Integrity

Structural integrity checks include:
- duplicate step id rejection.
- duplicate operation identity rejection.
- unknown predecessor/successor/conditional/rework reference rejection.
- self-cycle rejection.
- deterministic cycle detection for two-node, multi-node, and hidden dependency cycles.

Rework edges are modeled explicitly and excluded from structural topological ordering while still traceable in validation results.
