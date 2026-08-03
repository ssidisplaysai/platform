# 05 Transport Hardening

Implemented behavior:
1. Dispatch now uses bounded retry attempts (default 3) with explicit timeout guard.
2. Failure classification:
   - TRANSPORT_UNAVAILABLE
   - DISPATCH_TIMEOUT
   - PERMANENT_FAILURE
3. Retry logic:
   - Retry only for transient classes (unavailable/timeout).
   - Emit DISPATCH_RETRY audit and increment dispatchRetryCount on retry.
   - Emit DISPATCH_RETRY_EXHAUSTED audit at terminal retry exhaustion.
4. Dispatch failure still transitions occurrence/instance failure paths consistently.
5. Audit persistence failures no longer crash scheduler flow; failures are visible through:
   - auditFailureCount
   - AUDIT_PERSISTENCE_FAILURE audit entry in in-memory audit stream.

Negative-path coverage added:
1. Messaging unavailable then retry success.
2. Timeout retry exhaustion.
3. Permanent failure no-retry path.
4. Audit store append failure visibility path.
