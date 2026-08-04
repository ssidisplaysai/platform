# 05 Dependency Standard

Every proposed platform must document:

- Required upstream platforms
- Optional integrations
- Forbidden dependencies
- Ownership boundaries
- Dependency direction

Dependency rules:

- Circular dependencies are prohibited.
- Dependency direction must preserve ownership hierarchy and contract boundaries.
- Dependencies may not bypass certified contracts.
- Forbidden dependencies must be explicitly named to prevent constitutional drift.

Dependency governance objective:

- Ensure each platform enters engineering with a coherent, bounded, and constitutionally valid dependency posture.
