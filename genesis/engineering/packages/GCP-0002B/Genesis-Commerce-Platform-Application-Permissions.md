# Genesis Commerce Platform Application Permissions

## Role Set
1. platform_admin
2. ops_manager
3. company_operator
4. analyst
5. viewer

## Permission Actions
1. workspace:view
2. workspace:manage
3. organization:switch
4. site:switch
5. settings:view
6. settings:manage
7. notifications:view
8. notifications:manage
9. audit:view
10. command_palette:use
11. search:use

## Policy Model
A role-to-permission matrix resolves a flattened permission Set for runtime checks.

## Applied Gates
1. Navigation visibility uses requiredPermissions checks
2. Command palette availability checks command_palette:use
3. Settings page sections show read-only state when settings:manage is absent
4. Search and audit routes are omitted when permissions do not allow access

## Validation Coverage
Tests verify:
1. Viewer role hides audit and enterprise search navigation
2. Ops manager can query command palette actions
3. Viewer receives zero command palette actions
4. Non-admin settings state remains read-only for manage sections
