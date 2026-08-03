# 08 Persistence and Recovery

Persistence strategy:
1. Notification state is stored in a dedicated file-backed store under `data/notifications/notifications-state.json`.
2. Stored sections include definitions, templates, suppression rules, requests, attempts, dead letters, audits, and metrics.
3. Writes are serialized with an internal queue to avoid concurrent corruption in the single-process foundation.

Recovery strategy:
1. Missing files initialize a clean default state.
2. Invalid JSON sections are recovered to safe defaults.
3. Recovery diagnostics are surfaced to health and audit flows.
4. Corrupt state detection is treated as observable operational evidence.
