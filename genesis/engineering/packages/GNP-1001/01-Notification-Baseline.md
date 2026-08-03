# 01 Notification Baseline Inventory

Objective:
- Capture current notification-related capability before GNP-1001 implementation.

Files inspected:
1. src/platform/gop/contracts.ts
2. src/platform/gop/runtime/notification-center.ts
3. src/platform/gop/runtime/orchestrator.ts
4. src/platform/gop/auth/policies.ts
5. src/lib/glw/n8n.ts
6. src/lib/gop/events-api.ts
7. src/platform/messaging/services/DeliveryPipeline.ts
8. src/platform/messaging/persistence/FileDeadLetterStore.ts

Current responsibilities and behavior:
1. GOP contains an in-memory notification center (`createGenesisNotificationCenter`) for mission-control style notices (list, unread, markRead) and does not provide durable persistence.
2. GOP contracts define `GenesisNotification` and `GenesisPlatformNotification` for runtime and UI alerts, including channels such as IN_APP, EMAIL, WEBHOOK, TEAMS, and SLACK.
3. GOP orchestrator emits operator-facing notifications for workflow/runtime events but does not include independent recipient resolution, preference policy, suppression, retry scheduling, or dead-letter workflow specific to notifications.
4. Existing `src/lib/glw/n8n.ts` is a webhook transport adapter for GLW page generation workflow execution and is not a generalized notification delivery provider.
5. Messaging platform already includes queue, retry, and dead-letter infrastructure for message transport but not notification-domain contracts (template resolution, recipient preference, suppression, quiet-hours, idempotent notification request lifecycle).
6. GOP metrics aggregation exists in `src/lib/gop/events-api.ts` and already reports metrics/health for identity, authorization, messaging, workflow, and scheduling capabilities.

Overlap and compatibility risks:
1. Naming overlap risk: GOP runtime notifications and GNP platform notifications both use the term notification. Mitigation: keep GOP runtime alert model untouched and introduce GNP as separate capability namespace `platform.notifications`.
2. Channel overlap risk: GOP contracts include TEAMS/SLACK, while GNP foundation scope intentionally supports EMAIL/SMS/PUSH/WEBHOOK/IN_APP only with in-memory provider adapters. Mitigation: no modifications to GOP contract channel union during GNP foundation.
3. Persistence overlap risk: messaging and scheduling already write to durable file-backed stores. Mitigation: use dedicated `data/notifications/notifications-state.json` to avoid cross-capability schema coupling.
4. API overlap risk: existing mission-control endpoints use auth boundary and capability payload structure. Mitigation: new notification health/metrics routes follow same session gate and payload conventions.

Provider/template/recipient assumptions captured:
1. No third-party provider SDK assumptions are permitted in foundation; adapters are in-memory only.
2. Templates are immutable by version and channel and must define required placeholders.
3. Recipient references may carry explicit channel addresses or identity references; unresolved recipients must produce auditable outcomes.
4. Idempotency is request-key-based and must prevent duplicate processing side effects.

Migration constraints:
1. Do not rewrite GOP runtime notification center in this work order.
2. Do not alter n8n adapter contract semantics.
3. Preserve existing mission-control metrics behavior while extending aggregate payload with notification section.
4. Keep notification capability independent from workflow/scheduling execution authority boundaries.
