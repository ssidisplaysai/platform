# Genesis Production Job Authorization

## Roles
Production Job permissions are integrated into foundation role model including planner, supervisor, operations, admin, and executive/auditor read paths.

## Permission Set
- `production_jobs:create`
- `production_jobs:read`
- `production_jobs:update`
- `production_jobs:release`
- `production_jobs:start`
- `production_jobs:pause`
- `production_jobs:resume`
- `production_jobs:complete`
- `production_jobs:cancel`
- `production_jobs:close`
- `production_jobs:audit`
- `production_jobs:search`

## Enforcement Points
- Request authorization via `authorizeRequest`.
- Role-permission mapping in foundation permission matrix.
- Organization/site boundary validation on all route handlers.

## Security Outcome
Only authorized roles within explicit tenant scope can mutate or inspect production-job execution records.
