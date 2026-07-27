# GBA-0007 Authorization Model

## Module Boundary

1. moduleId: gba.customer_success
2. Workspace boundary: glw-led-display-warehouse

## Action Set

1. gba:customer_success:view_dashboard
2. gba:customer_success:view_customer_health
3. gba:customer_success:view_onboarding
4. gba:customer_success:view_success_plans
5. gba:customer_success:view_renewals
6. gba:customer_success:view_satisfaction
7. gba:customer_success:view_kpis
8. gba:customer_success:view_recommendations
9. gba:customer_success:review_recommendations
10. gba:customer_success:view_executive_reports
11. gba:customer_success:view_timeline
12. gba:customer_success:view_health

## Policy Integration

1. Operator/manager/admin/developer/system role set receives read surfaces plus recommendation review.
2. Viewer role receives read-only surfaces and does not receive recommendation review.
3. Route-level protected pages call resolveGbaCustomerSuccessPermissions and enforce notFound on denied route access.
4. API handlers enforce session + authorization before runtime execution.
