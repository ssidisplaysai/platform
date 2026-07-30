# Genesis Commerce Platform Inventory Permissions

## Permission Surface
Inventory permissions include bounded capabilities for:
1. inventory:read
2. inventory:availability:read
3. inventory:locations:read
4. inventory:locations:manage
5. inventory:movements:read
6. inventory:movements:create
7. inventory:movements:reverse
8. inventory:reservations:read
9. inventory:reservations:create
10. inventory:reservations:release
11. inventory:counts:submit
12. inventory:counts:apply
13. inventory:reorder:evaluate

## Role Mapping Baseline
1. platform_admin: full inventory capability set.
2. ops_manager: full operational inventory capability set.
3. company_operator: bounded operational subset.
4. analyst: read/audit/evaluation subset.
5. viewer: no inventory write capabilities.

## Enforcement Notes
1. Read and write checks are enforced server-side on API handlers.
2. Command/navigation visibility follows required permission contracts.
3. Permission checks reuse shared foundation authorization policy.
