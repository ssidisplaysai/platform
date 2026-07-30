# Genesis Work Order Test Plan

## Test Layers
1. Foundation repository behavior tests
2. API contract and authorization tests
3. Scoped lint and diagnostics checks for modified files

## Repository Scenarios
- Create from sales-order lineage
- Duplicate conversion rejection
- Lifecycle transition validity and invalid-path rejection
- Revision creation and retrieval
- Audit stream creation
- Timeline and search behavior
- Published-event emission checks

## API Scenarios
- Authorization denial for insufficient roles
- Scope checks for organization/site mismatches
- CRUD and mutation route responses
- Revision, timeline, audit route responses
- Lifecycle route behavior for release, pause/resume, and cancel

## Acceptance Criteria
- Focused work-order test suites pass
- No relevant lint/type errors in touched GMP-0002 files
- Boundary scan confirms no prohibited execution domains added
