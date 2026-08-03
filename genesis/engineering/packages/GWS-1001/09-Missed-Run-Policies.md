# 09 Missed-Run Policies

## Supported Policies

1. SKIP
2. RUN_ONCE
3. CATCH_UP_ALL
4. CATCH_UP_LIMITED
5. FAIL

## Behavior

1. SKIP: execute only the current due run.
2. RUN_ONCE: execute one current run and discard backlog.
3. CATCH_UP_ALL: execute all bounded due runs.
4. CATCH_UP_LIMITED: execute bounded subset of due runs plus current.
5. FAIL: fail schedule evaluation on missed-run backlog.

## Conditions Addressed

1. Process downtime
2. Delayed evaluator execution
3. Multiple missed occurrences
4. Catch-up bounding to avoid unbounded replay
