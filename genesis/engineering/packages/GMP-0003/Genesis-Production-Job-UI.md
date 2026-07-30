# Genesis Production Job UI

## Foundation Views
- `ProductionJobsRegistryView`
- `ProductionJobCreateView`
- `ProductionJobSummaryView`
- `ProductionJobDetailView`

## App Routes
- `/production-jobs`
- `/production-jobs/new`
- `/production-jobs/summary`
- `/production-jobs/search`
- `/production-jobs/from-work-order/{workOrderId}`
- `/production-jobs/{productionJobId}`
- `/production-jobs/{productionJobId}/timeline`
- `/production-jobs/{productionJobId}/audit`
- `/production-jobs/{productionJobId}/revisions`
- `/production-jobs/{productionJobId}/lineage`
- `/production-jobs/{productionJobId}/search`

## UI Intent
Provide registry, lifecycle visibility, lineage transparency, and audit/revision observability for governance users.

## UI Boundary
UI is intentionally read/projection and command invocation oriented. It does not provide execution control surfaces for machines, IoT, or MES.
