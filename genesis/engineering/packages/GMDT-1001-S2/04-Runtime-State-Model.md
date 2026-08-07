# 04 Runtime State Model

Runtime phases:
- CREATED
- INITIALIZING
- READY
- STOPPING
- STOPPED
- FAILED

State guarantees:
- Explicit transitions only.
- Invalid transitions reject with deterministic runtime error classification.
- Failure states retain bounded failure evidence.
