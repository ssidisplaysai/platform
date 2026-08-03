# 02 Architecture

The Genesis Notification Platform foundation is a contract-first capability under `platform.notifications`.

Architecture summary:
1. Contracts define notification definitions, templates, requests, recipients, preferences, suppression, attempts, retry decisions, dead letters, audits, metrics, and health.
2. Services separate responsibility into registry, rendering, recipient resolution, preference policy, suppression, routing, lifecycle validation, attempt tracking, retry, dead-letter handling, dedupe, audit, metrics, and health.
3. Providers are abstracted behind a small channel provider interface and the foundation uses in-memory adapters only.
4. Persistence is file-backed and dedicated to notification state, recovery diagnostics, and metrics.
5. Mission Control exposes health and metrics endpoints only; it does not execute deliveries or own business rules.

Boundary controls:
1. Notifications do not own contacts; they consume recipient references and channel addresses supplied by upstream systems.
2. Notifications do not own campaigns; there is no campaign scheduling or marketing workflow.
3. Notifications do not own transport; the engine calls provider adapters, not infrastructure transports directly.
4. Notifications do not own timing; quiet hours and deferrals are policy checks only, not scheduling authority.
5. Notifications do not own workflow execution; workflow engines may request notifications but remain separate bounded capabilities.
6. Notifications do not own application business logic; they only process notification-domain requests.
