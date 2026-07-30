# Genesis Commerce Platform Navigation Architecture

## Navigation Foundation
Navigation is now defined as typed architecture data with explicit permission requirements.

## Navigation Inventory
1. Mission Control (/)
2. Companies (/companies)
3. Settings (/settings)
4. Notifications (/notifications)
5. Audit (/audit)
6. Enterprise Search (/search)

## Permission Mapping
1. workspace:view: Mission Control, Companies
2. settings:view: Settings
3. notifications:view: Notifications
4. audit:view: Audit
5. search:use: Enterprise Search

## Command Palette Foundation Actions
1. Open Companies
2. Open Settings
3. Open Notifications
4. Open Audit
5. Open Enterprise Search

All command actions require command_palette:use plus route-specific permissions.

## Behavioral Rules
1. Hidden routes are not rendered in navigation when permissions are absent
2. Command palette actions are filtered by both permission and text query
3. Active route is highlighted by pathname match

## Extension Pattern
Future modules should append typed navigation items with requiredPermissions and avoid direct shell hardcoding.
