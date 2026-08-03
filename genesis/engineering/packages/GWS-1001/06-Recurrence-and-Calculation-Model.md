# 06 Recurrence and Calculation Model

## Supported Schedule Types

1. ONE_TIME
2. INTERVAL
3. RECURRING (DAILY/WEEKLY/MONTHLY)
4. CRON (5-field)
5. CALENDAR (months/day-of-month/day-of-week/time-of-day)

## Calculation Rules

1. Start and end boundaries are enforced.
2. Maximum occurrence cap is enforced by engine and calculator inputs.
3. Invalid schedules return invalid-definition outcomes.
4. Due run generation is bounded.

## Missed Runs

Policies:
1. SKIP
2. RUN_ONCE
3. CATCH_UP_ALL
4. CATCH_UP_LIMITED
5. FAIL

Catch-up is bounded by policy limit and engine due-run cap.
