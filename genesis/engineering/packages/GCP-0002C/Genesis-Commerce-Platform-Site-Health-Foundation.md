# Genesis Commerce Platform Site Health Foundation

## Health States
1. unknown
2. healthy
3. degraded
4. unhealthy
5. not_configured

## Connection-Test Contract
`SiteConnectionTestAdapter` returns structured result:
1. status
2. message
3. checkedAt
4. details (optional)

## Bounded Adapter Behavior
1. Returns not_configured when required references are missing.
2. Returns unavailable when external runtime calls are outside package scope.
3. Does not fabricate successful production connection checks.

## UI Surface
1. Site health route shows connection test status, message, and timestamp.
2. Readiness blockers are presented alongside health status.
3. Disabled or unconfigured states are visible and explicit.
