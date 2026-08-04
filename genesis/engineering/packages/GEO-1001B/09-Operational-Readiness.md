# 09 Operational Readiness

Runtime prerequisites for local validation:
- GLW_ADMIN_EMAIL
- GLW_ADMIN_PASSWORD
- GLW_AUTH_SECRET

Additional prerequisite for Prisma-backed diagnostics and related runtime checks:
- DATABASE_URL

Readiness note:
- Organization remediation behavior is deterministic and fail-closed for C1-C3 integrity conditions.
- Required validation command execution environment must provide listed variables for full test reproducibility.
