# Genesis Commerce Platform Application Shell

## Shell Foundation Goals
1. Provide a stable application-level frame for all bounded pages
2. Enforce role-aware visibility controls in primary navigation
3. Expose workspace context with organization and site selectors
4. Provide global command palette entry point and enterprise search entry point

## Implemented Shell Composition
1. Left rail with brand header and permission-filtered navigation
2. Workspace context card containing:
   - Active user identity
   - Role labels
   - Organization selector
   - Site selector derived from selected organization
3. Top shell utility bar containing:
   - Enterprise Search quick action
   - Command Palette toggle gated by command_palette:use permission
4. Inline command palette panel with query filtering and permitted command links

## State Model
1. Default foundation context generated from CompanyRepository seed data
2. Selected organization state managed at shell level
3. Selected site state auto-resolved on organization switch
4. Command palette open/query state managed at shell level

## Permission Controls
1. Navigation items are filtered by required permission lists
2. Command palette button is disabled when role lacks command_palette:use
3. Command palette actions are filtered by role and query

## Bounded Outcomes
1. Existing dashboard and companies routes remain operational
2. No platform authority data ownership changes were introduced
3. Shell supports future module insertion without rework of context/permission contracts

## GCP-0002C Multi-Site Extension
1. Shell site selector now uses explicit site configuration records instead of implicit per-organization placeholders.
2. Selected organization and selected site persist in client storage where available.
3. Invalid persisted site IDs do not silently fall back; shell shows explicit unavailable-site messaging.
4. Site badges now expose environment, health, publishing status, and disabled-state indication.

## GCP-0002D Product/Catalog Extension
1. Shell navigation now includes Products, Categories, and Manufacturers entries when permitted.
2. Command palette now includes product catalog actions for products, categories, and manufacturers.
3. Existing organization/site selection behavior remains unchanged and is reused by product/catalog routes.

## GCP-0002E Inventory Extension
1. Shell navigation now includes Inventory entry when inventory read permission is present.
2. Command palette now includes inventory actions for locations, movements, reservations, and product inventory.
3. Existing organization/site selection context is reused for inventory availability and reservation scope.

## GCP-0002F Integration Profiles Extension
1. Shell navigation now includes Profiles entry when profile read permission is present.
2. Command palette now includes profile actions for publishing, WordPress, workflow, prompt, image, SEO, brand, and analytics registries.
3. Existing organization/site context is reused for profile assignment, inheritance, and readiness visibility.
