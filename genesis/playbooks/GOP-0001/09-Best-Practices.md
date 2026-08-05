# 09 Best Practices

## Proven practices from GKN-1001

1. Keep platform ownership narrow.
- Restrict implementation to approved ownership slices.
- Explicitly list out-of-scope capabilities.

2. Repair shared infrastructure separately.
- Use dedicated foundation maintenance work orders for shared baseline defects.

3. Never hide inherited baseline issues.
- Document inherited failures explicitly.
- Prove independence with ancestry/blob evidence.

4. Keep certification evidence independent.
- Certification should verify, not implement.
- Use objective command evidence and condition matrices.

5. Separate governance from implementation.
- Governance defines boundaries.
- Engineering executes inside approved boundaries.

6. Keep commits atomic.
- One work order, one purpose, one commit where feasible.
- Avoid mixed engineering/certification changes.

7. Maintain deterministic validation.
- Run required commands consistently.
- Capture environment metadata and timestamps.

8. Use explicit condition closure workflows.
- Track each condition to resolution with targeted evidence.
