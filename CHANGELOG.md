## v1.0.0 — Genesis Operator Platform Enterprise Certification

Status: Candidate Approved (Internal Production)
Date: 2026-07-26

### Added
- GOP-0005 durable runtime foundations (durable executions, snapshots, replay, recovery APIs)
- GOP-0006 runtime fabric foundations (distributed lease semantics, worker protocol, dead-letter controls)
- GOP v1.0 certification artifacts and release package documents

### Validated
- Constitutional conformance across GOP runtime and API surfaces
- Focused GOP and GLW compatibility test coverage
- Worker signed-token protocol validation
- Runtime fabric failure and chaos simulation coverage

### Operational Notes
- Pending additive migrations remain:
	- 20260726093000_gop_execution_store
	- 20260726103000_gop_runtime_fabric

### Recommended Tag
- v1.0.0

## v0.3.0 — Enterprise UI Foundation

Status: In Progress

### Added
- Mission Control module shell
- Executive Briefing widget
- Company Health widget
- Priority Tasks widget
- AI Recommendations widget
- Recent Activity widget
- Quick Actions widget
- Projects module restored under correct module structure

- Reusable MetricsGrid component
- Reusable DataTable component
- Reusable DataTableToolbar component
- Dynamic company workspace now renders modular table content

### Planned

- CompanyTabs
- ModuleHeader
- StatusBadge
- EmptyState
- Global Command Palette