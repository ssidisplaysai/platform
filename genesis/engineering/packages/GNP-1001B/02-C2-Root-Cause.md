# 02 C2 Root Cause

Why audit failure visibility was incomplete:
1. Audit writes were previously treated as best-effort side effects without explicit retry/failure classification in the engine flow.
2. `NotificationAuditWriter` did not classify append failures or publish an observable failure event.
3. `NotificationEngine` did not preserve audit failure counts, retry counts, backlog, or latency as first-class operational signals.
4. Health reporting exposed the audit writer as available, but not the actual failure posture of the audit path.

Failure propagation gaps:
- Audit persistence errors could be swallowed by surrounding control flow instead of being surfaced as explicit operational evidence.
- Metrics included an `auditFailures` field, but the write path did not enforce or increment it.

Impact:
- Operators could not reliably distinguish normal completion from completion with audit degradation.
- Recovery and health reporting lacked the explicit audit-failure visibility required by the condition.
