# GEA-0002 Authorization

## Authorization Engine
Tool authorization is implemented in src/lib/gea/tool-authorization.ts.

## Default-Deny Evaluation
An invocation is allowed only when all checks pass:
1. Tool has an active version.
2. Runtime state is valid (not cancelled).
3. Tool lifecycle state is ACTIVE.
4. Required capabilities are present in caller capability permissions.
5. Required permission actions are present in caller permissions.

Any failed condition returns denied with reason and full evaluation context.

## Policy Surface
Added GEA tool permissions:
1. gea:tools:view
2. gea:tools:execute
3. gea:tools:replay
4. gea:tools:view_audit
5. gea:tools:manage_registry
6. gea:tools:manage_versions
7. gea:tools:view_health
8. gea:tools:validate

## Integration Points
1. GOP policies updated in src/platform/gop/auth/policies.ts.
2. Protected tool workspace checks implemented in src/app/glw/(protected)/tools/access.ts.
3. API route authorization implemented in src/lib/gea/tool-api.ts.
