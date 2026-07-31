# Operational Readiness

## Added Readiness Signals

- queueDepth
- retryDepth
- deadLetterDepth
- oldestPendingMessageAt
- durability mode
- multi-node readiness posture

## Health Enhancements

Messaging health now includes:

- failure rate
- retry/dead-letter queue observations
- persistence/audit/transport failure counters

## Operational Conclusion

Messaging foundation is materially more restart-safe and operationally observable than GMP-1001 while preserving platform boundaries and compatibility.