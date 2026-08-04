# 08 Boundary and Dependency Standard

Boundary rules:

- Engineering shall never expand ownership beyond approved architecture.
- Engineering shall consume external capabilities through contracts only.
- Engineering shall remain provider neutral.
- Engineering shall remain storage neutral.
- Engineering shall remain AI neutral.
- Mission Control integration shall remain observational only.

Dependency governance rules:

- Required/optional/forbidden dependencies must be explicitly documented.
- Consumer-only interaction must be preserved.
- Circular dependency introduction is prohibited.
- Implementation-level bypass of contract boundaries is prohibited.

Boundary non-compliance blocks certification handoff.
