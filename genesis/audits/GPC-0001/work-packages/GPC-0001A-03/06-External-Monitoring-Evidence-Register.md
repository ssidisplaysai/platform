# GPC-0001A-03 External Monitoring Evidence Register

Program: GPC-0001  
Work package: GPC-0001A-03  
Date: 2026-07-29

## 1. Rule

This register records monitoring and incident tooling evidence that exists outside repository artifacts. It does not recreate, infer, or fabricate external controls.

Required fields per entry:
1. Evidence source
2. Owner
3. Verification method
4. Verification date (if available)
5. Certification impact if unavailable

## 2. External Evidence Requirements

| Evidence Domain | Evidence Source | Owner | Verification Method | Verification Date | Certification Impact if Unavailable |
|---|---|---|---|---|---|
| Production uptime monitoring (web/API) | External uptime/ping monitoring platform | @genesis-runtime | Export uptime checks, alert rules, and recent outage history | Not available in repository | Cannot certify external uptime monitoring coverage |
| Centralized log collection | External log aggregation platform | @genesis-runtime | Collect pipeline config and ingestion verification for API/runtime logs | Not available in repository | Cannot certify centralized log collection |
| Log retention policy | External logging platform policy controls | @genesis-runtime + @genesis-security | Verify retention config and access controls | Not available in repository | Cannot certify retention compliance |
| Metrics storage/retention backend | External metrics platform | @genesis-runtime | Verify metrics ingestion, retention windows, and queryability | Not available in repository | Cannot certify longitudinal trend observability |
| Paging/alert dispatch tooling | External paging/on-call platform | @genesis-build + @genesis-engineering-lead | Verify route mappings from SEV-1..SEV-4 to on-call responders | Not available in repository | Cannot certify alert delivery guarantees |
| Infrastructure monitoring (compute/network) | External cloud/infrastructure monitoring | @genesis-runtime | Verify host/runtime/network health alarms and dashboards | Not available in repository | Cannot certify infra dependency monitoring |
| Database platform alarms | External managed DB monitoring | @genesis-runtime | Verify DB latency/error/storage alarms and historical alert tests | Not available in repository | Cannot certify database telemetry outside app layer |
| DNS/SSL/reverse-proxy monitoring | External edge platform and cert manager | @genesis-security + @genesis-runtime | Verify edge health checks and certificate expiry alerts | Not available in repository | Cannot certify edge-path health monitoring |
| n8n platform monitoring | External n8n host monitoring | @genesis-runtime | Verify n8n health checks, error alerts, and incident logs | Not available in repository | Cannot certify integration uptime monitoring |
| Incident management system records | External incident management tooling | @genesis-engineering-lead | Verify incident lifecycle records, communications timeline, PIR completion | Not available in repository | Cannot certify process execution evidence |

## 3. Priority Sequence

Priority 1 (blocking):
1. Uptime monitoring, paging, and incident management records.
2. Database platform alarms and retention evidence.
3. Centralized logging and retention evidence.

Priority 2 (high):
1. Infrastructure monitoring (compute/network).
2. Edge DNS/SSL/proxy monitoring.
3. n8n external platform monitoring evidence.

Priority 3 (supporting):
1. Historical trend dashboard exports and periodic verification attestations.
