# Genesis Commerce Platform Site Permissions

## Added Capabilities
1. sites:read
2. sites:create
3. sites:update
4. sites:enable
5. sites:disable
6. sites:test_connection
7. sites:manage_integrations
8. sites:view_health
9. sites:view_audit

## Role Mapping
1. platform_admin: full site capabilities
2. ops_manager: full site capabilities for bounded operations
3. company_operator: read/update/test/view_health
4. analyst: read/view_health/view_audit
5. viewer: no site capabilities

## Enforcement
1. UI visibility is permission-aware but not authoritative alone.
2. Site API routes enforce authorization server-side for write/test operations.
3. Unauthorized site detail access resolves to safe unauthorized state.

## Governance Boundary
Application capability checks do not claim Genesis constitutional authority and do not replace runtime governance controls.
