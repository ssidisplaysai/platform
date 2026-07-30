# Genesis Routing Architecture

Routing is the authoritative manufacturing process-definition aggregate.

Architecture rules:
- Routing defines ordered Operations.
- Routing contains references only.
- Routing does not schedule, assign, or execute work.
- Routing version history is immutable.
- Routing changes are persisted through the foundation repository pattern.

Result: PASS