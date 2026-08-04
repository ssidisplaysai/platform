# 02 C2 Root Cause

Condition C2:

- Mission Control Contact observability routes required session presence but did not perform explicit authorization decision evaluation.

Root cause:

- Contact health and metrics routes did not call the GOP authorization resolver.
- Session-authenticated callers were not explicitly evaluated against action-based policy.

Risk produced:

- Access path did not enforce deny-by-default policy semantics.
- Denied authorization metrics were not surfaced for this route path.

Resolution strategy:

- Add resolver-backed authorization for each route using explicit action IDs.
- Keep behavior observability-only (no ownership changes).
- Return 403 on denied decisions with reason code and denied-count metrics snapshot.
