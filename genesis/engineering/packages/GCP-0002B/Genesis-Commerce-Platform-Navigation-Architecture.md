# Genesis Commerce Platform Navigation Architecture

## Navigation Foundation
Navigation is now defined as typed architecture data with explicit permission requirements.

## Navigation Inventory
1. Mission Control (/)
2. Companies (/companies)
3. Sites (/sites)
4. Settings (/settings)
5. Notifications (/notifications)
6. Audit (/audit)
7. Enterprise Search (/search)

## Permission Mapping
1. workspace:view: Mission Control, Companies
2. sites:read: Sites
3. settings:view: Settings
4. notifications:view: Notifications
5. audit:view: Audit
6. search:use: Enterprise Search

## Command Palette Foundation Actions
1. Open Companies
2. Open Sites
3. Create New Site
4. Open Settings
5. Open Notifications
6. Open Audit
7. Open Enterprise Search

All command actions require command_palette:use plus route-specific permissions.

## Behavioral Rules
1. Hidden routes are not rendered in navigation when permissions are absent
2. Command palette actions are filtered by both permission and text query
3. Active route is highlighted by pathname match

## Extension Pattern
Future modules should append typed navigation items with requiredPermissions and avoid direct shell hardcoding.
