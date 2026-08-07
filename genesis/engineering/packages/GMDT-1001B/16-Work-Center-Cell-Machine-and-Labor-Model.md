# 16 Work Center Cell Machine and Labor Model

## WorkCenter and ProductionCell

Manufacturing owns:
- operational work-center definition
- production-cell definition
- operational availability and status
- execution-capacity metadata

Model fields include:
- identity and business code
- status and availability
- capacity and concurrency limits
- location reference where applicable
- maintenance or quality-hold references
- lifecycle state
- version

## MachineAssignment and ToolAssignment

Manufacturing owns assignment state; Asset platform may own canonical machine or tool identity.

Assignment model includes:
- assignment identity
- target execution reference
- asset reference
- effective date range
- assignment status
- concurrency and capacity constraints
- lifecycle and version

## LaborAssignment

Manufacturing may own:
- assignment to execution
- operator role
- labor start and end facts
- labor duration
- production association

Manufacturing must not own:
- canonical person identity
- payroll
- HR lifecycle
- authentication identity

Foreign identity references are mandatory for labor identity linkage.
