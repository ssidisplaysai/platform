# GBA-0002 Workspace Routes

## Protected Routes
- `/glw/operations-agent`
- `/glw/operations-agent/work-orders`
- `/glw/operations-agent/production`
- `/glw/operations-agent/warehouse`
- `/glw/operations-agent/inventory`
- `/glw/operations-agent/purchasing`
- `/glw/operations-agent/shipping`
- `/glw/operations-agent/capacity`
- `/glw/operations-agent/kpis`
- `/glw/operations-agent/recommendations`
- `/glw/operations-agent/vendors`
- `/glw/operations-agent/timeline`
- `/glw/operations-agent/health`

## Access Resolver
- File: `src/app/glw/(protected)/operations-agent/access.ts`
- Route-action map enforces least-privilege checks.
- Unauthorized route access resolves to `notFound()`.
