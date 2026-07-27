# GBA-0005A Security Certification

## Security Controls Validated
1. Authentication
- API handlers require GLW session.

2. Authorization
- Action-based authorization enforced through GOP resolver.
- Sales actions validated:
  - gba:sales:view_dashboard
  - gba:sales:view_pipeline
  - gba:sales:manage_pipeline
  - gba:sales:view_forecasting
  - gba:sales:view_accounts
  - gba:sales:view_recommendations
  - gba:sales:review_recommendations
  - gba:sales:view_health

3. Default Deny
- Unauthorized/missing permissions return forbidden outcomes.

4. Workspace Isolation
- Authorization checks are workspace-scoped in route and API layers.

5. Route Protection
- Protected workspace route access resolver blocks unauthorized access.

## Evidence
- Focused authorization/API tests: PASS
- Viewer mutation denial verified for pipeline management.
- Session-required behavior verified for dashboard/API.

## Conclusion
Sales security model is certified for v1.0 freeze with no Sales-owned security blockers.
