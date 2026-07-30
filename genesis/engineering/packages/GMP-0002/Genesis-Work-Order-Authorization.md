# Genesis Work Order Authorization

## Permission Surface
- work_orders:read
- work_orders:create
- work_orders:update
- work_orders:release
- work_orders:revise
- work_orders:pause
- work_orders:cancel
- work_orders:view_audit
- work_orders:view_revisions

## Route Guard Pattern
API routes enforce:
- Permission via authorizeRequest
- Organization scope via resolveRequestScope and hasOrganizationScope
- Record-level scope via isRecordInScope

## Role Integration
Manufacturing-focused roles were added for bounded operational access:
- manufacturing_planner
- production_supervisor
- executive
- administrator
