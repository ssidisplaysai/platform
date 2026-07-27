# GEA-0001 Permission Framework

## Policy Model
Permission engine implemented in src/lib/gea/permission-engine.ts applies default deny.

## Evaluation Inputs
1. workspaceId / projectId / organizationId scope context
2. subject role
3. required capabilityKey
4. optional toolKey
5. runtime state
6. allowedActions list

## Decision Logic
Allowed only when all conditions hold:
1. allowedActions includes capability:<capabilityKey>
2. if toolKey exists, allowedActions includes tool:<toolKey>
3. runtime state is not CANCELLED

Otherwise the result is denied with reason:
Default deny: missing capability/tool policy or invalid runtime state.

## GOP Action Surface
Integrated action identifiers:
1. gea:agents:view
2. gea:agents:execute
3. gea:agents:replay
4. gea:agents:approve_plans
5. gea:agents:manage_capabilities
6. gea:agents:manage_tools
7. gea:agents:view_audit
8. gea:agents:view_memory
9. gea:agents:manage_context
10. gea:agents:view_health

Policy allowlists were updated in src/platform/gop/auth/policies.ts.
