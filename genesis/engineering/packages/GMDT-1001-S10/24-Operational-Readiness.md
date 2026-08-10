# 24 Operational Readiness

Readiness outcome:
- persistence/recovery implementation is operational when an explicit durable root is configured
- READY is blocked on recovery failure
- valid first-run empty state reaches READY
- persistence-aware health and metrics are available
- legacy non-persistence tests remain isolated through ephemeral default roots
