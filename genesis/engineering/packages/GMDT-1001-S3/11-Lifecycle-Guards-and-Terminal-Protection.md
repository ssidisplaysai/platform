# 11 Lifecycle Guards and Terminal Protection

Lifecycle mutation rules include:
- Allowed transition graph enforcement.
- Terminal state mutation protection.
- Invalid transition rejection with auditable classification.

Guard order was tuned to preserve deterministic invalid-transition semantics before downstream readiness-dependent mutations.
