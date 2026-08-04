# 04 Hierarchy Integrity

Implemented controls:
- Self-parent rejection
- Direct cycle rejection
- Indirect cycle rejection
- Recursive ancestor loop rejection
- Deterministic path/depth recomputation during upsert
- Parent-child child list normalization
- Fail-closed recovery validation for hierarchy integrity

Validation posture:
- Validation occurs before persistence save.
- Invalid hierarchy state blocks runtime recovery.
