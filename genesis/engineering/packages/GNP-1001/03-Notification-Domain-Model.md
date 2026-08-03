# 03 Notification Domain Model

Core domain objects:
1. NotificationDefinition identifies a notification type, allowed channels, template bindings, and retry policy.
2. TemplateDefinition describes channel-specific subject/title/body rendering with required variables.
3. NotificationRequest captures idempotent delivery intent, tenant/workspace ownership, recipients, payload, and correlation metadata.
4. RecipientReference and ResolvedRecipient separate upstream identity references from resolved channel addresses.
5. NotificationAuditRecord captures durable lifecycle evidence for request, routing, delivery, retry, suppression, and recovery events.
6. NotificationMetrics summarizes operational counters for requested, delivered, failed, deferred, dead-lettered, and recovered notifications.

Domain constraints:
1. Templates are versioned by semantic version tuple and channel.
2. Requests are request-idempotent and can be deduplicated by idempotency key.
3. Recipient resolution is explicit and boundary-aware.
4. Delivery state transitions are restricted by lifecycle rules.
