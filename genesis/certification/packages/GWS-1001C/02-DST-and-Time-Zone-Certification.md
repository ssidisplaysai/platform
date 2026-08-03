# 02 DST and Time Zone Certification

Implementation evidence reviewed:
1. src/platform/scheduling/services/Clock.ts
2. src/platform/scheduling/services/ScheduleCalculator.ts
3. src/platform/scheduling/services/OccurrenceClaimService.ts
4. src/platform/scheduling/services/SchedulingEngine.ts
5. src/platform/scheduling/services/SchedulingMetricsService.ts

Verification findings:
1. DST fall-back repeated-hour behavior is explicit through classifyOccurrenceTime and local-run-key ambiguity detection.
2. Ambiguous local times are deterministic via localRunKey and utcOffsetMinutes.
3. Duplicate prevention is explicitly enforced in SchedulingEngine by logicalRunKey lookup and FIRST_LOCAL_TIMESTAMP_WINS skip policy.
4. Occurrence identity remains stable across repeated local timestamps through logicalRunKey derivation.
5. Repeated local timestamps do not silently duplicate dispatch; duplicates are skipped with OCCURRENCE_SKIPPED audit.
6. Spring-forward handling remains deterministic and tested.
7. IANA timezone behavior remains deterministic through Intl.DateTimeFormat-based local part extraction.
8. DST ambiguity is visible via dstAmbiguityCount metric and audit events.

Direct test evidence reviewed:
1. supports timezone conversion and daylight-saving transitions
2. remains deterministic across multiple yearly DST transitions
3. applies deterministic fall-back duplicate prevention policy for repeated local timestamps

Condition status:
- C1: CLOSED.
