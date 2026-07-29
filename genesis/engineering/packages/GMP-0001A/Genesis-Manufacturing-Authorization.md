# Genesis Manufacturing Authorization

## Integration Model
Manufacturing foundation authorization integrates with existing foundation role and permission resolution.

## Permission Surface
1. manufacturing:read
2. manufacturing:create
3. manufacturing:update
4. manufacturing:revise
5. manufacturing:transition
6. manufacturing:view_audit
7. manufacturing:publish_events

## Role Integration
1. platform_admin includes full manufacturing foundation permissions.
2. ops_manager includes full manufacturing foundation permissions.
3. company_operator includes read/update permissions for bounded operational support.
4. analyst includes read and view_audit permissions.
5. viewer receives no manufacturing permissions.

## Runtime Helpers
1. resolveManufacturingPermissions
2. hasManufacturingPermission

## Boundary Guarantee
Authorization integration governs foundation infrastructure access only. No production execution permissions are introduced.
