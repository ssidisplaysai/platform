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
