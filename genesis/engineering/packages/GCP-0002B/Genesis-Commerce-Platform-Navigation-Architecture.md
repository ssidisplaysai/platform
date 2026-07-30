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

## GCP-0002D Extension
1. Added navigation routes: Products (/products), Categories (/categories), Manufacturers (/manufacturers).
2. Added command actions: Open Products, Create New Product, Open Categories, Open Manufacturers.
3. Added enterprise search index entries for product, category, and manufacturer registries.
4. Permission gates are enforced through products:* capability requirements.

## GCP-0002E Extension
1. Added navigation route: Inventory (/inventory).
2. Added command actions: Open Inventory Locations, Open Inventory Movements, Create Inventory Movement, Open Inventory Reservations, Open Product Inventory.
3. Added enterprise search index entries for inventory locations, stock, movements, and reservations.
4. Permission gates are enforced through inventory:* capability requirements.
