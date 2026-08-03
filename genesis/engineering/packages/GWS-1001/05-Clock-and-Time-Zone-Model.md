# 05 Clock and Time Zone Model

## Clock Abstraction

1. SystemClock provides runtime time source.
2. TestClock provides deterministic test control.
3. Scheduling services depend on Clock, not direct Date.now.

## Time Strategy

1. Persisted timestamps are UTC ISO-8601 strings.
2. Time-zone-aware schedule evaluation uses Intl.DateTimeFormat with IANA zone names.
3. Recurrence matching evaluates local date/time components derived from UTC candidates.
4. DST behavior is represented by evaluating real UTC instants through configured local zones.

## Deterministic Testability

1. Unit tests advance TestClock explicitly.
2. No direct Date.now dependency is required for scheduling decisions.
