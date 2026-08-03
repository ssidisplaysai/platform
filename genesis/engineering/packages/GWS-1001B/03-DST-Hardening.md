# 03 DST Hardening

Implemented behavior:
1. Added occurrence-time classification using timezone local run key and UTC offset extraction.
2. Added repeated-hour ambiguity detection by comparing adjacent UTC hour local-key collisions with offset deltas.
3. Added deterministic policy for repeated local timestamps:
   - Policy: FIRST_LOCAL_TIMESTAMP_WINS
   - Subsequent same logical local run key in ambiguous hour is skipped.
4. Added ambiguity metadata to occurrences:
   - logicalRunKey
   - utcOffsetMinutes
   - isDstAmbiguous
5. Added metrics and audit visibility:
   - dstAmbiguityCount
   - OCCURRENCE_SKIPPED audit detail with policy and logicalRunKey.

Test coverage added:
1. Spring-forward classification is non-ambiguous.
2. Fall-back repeated hour classification is ambiguous for both UTC occurrences.
3. Multi-year DST repeated-hour deterministic checks.
4. Engine duplicate prevention for repeated local timestamps.
