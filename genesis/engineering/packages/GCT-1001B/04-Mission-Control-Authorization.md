# 04 Mission Control Authorization

Implemented changes:

- Added shared authorization helper:
  - src/lib/gop/contact-observability-authorization.ts
- Helper performs explicit resolver-backed authorization using:
  - workspace: glw-led-display-warehouse
  - module: platform.contact
  - action IDs:
    - contact:health:view
    - contact:metrics:view
  - type: route_access
- Updated routes:
  - src/app/api/gop/contact/health/route.ts
  - src/app/api/gop/contact/metrics/route.ts

Route behavior:

- 401 when session is missing.
- 403 when authorization denies, with:
  - error reason
  - reasonCode
  - authorizationMetrics.deniedCount
- 200 with observability payload when authorized.

Guarantees:

- Deny-by-default behavior enforced via resolver decision path.
- Authorization decision auditing and metrics occur through authorization service.
- Contact observability-only ownership model remains unchanged.
