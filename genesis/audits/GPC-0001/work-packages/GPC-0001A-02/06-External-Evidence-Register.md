# GPC-0001A-02 External Evidence Register

Program: GPC-0001  
Work package: GPC-0001A-02  
Date: 2026-07-29

## 1. Rule

This register captures backup/restore/DR evidence that exists outside the repository. It does not recreate or infer external configurations.

## 2. External Evidence Requirements

| Evidence Domain | Owning System | Responsible Owner | Verification Method | Verification Date | Certification Impact if Unavailable |
|---|---|---|---|---|---|
| PostgreSQL backup policy (frequency, retention, backup type) | External DB hosting/backup platform | @genesis-runtime | Exported backup policy and retention settings reviewed by owner | Not available in repository | Cannot certify DB backup strategy values |
| PostgreSQL restore execution evidence | External DB hosting/backup platform | @genesis-runtime | Restore run logs, timestamps, and validation outputs | Not available in repository | Cannot certify DB restore RTO/RPO |
| PITR capability evidence (if applicable) | External DB hosting/backup platform | @genesis-runtime | Platform capability report and tested recovery record | Not available in repository | Cannot certify point-in-time recovery objective |
| Secrets backup/recovery controls | External secrets platform | @genesis-security | Secret recovery runbook evidence and access audit trail | Not available in repository | Cannot certify secrets recovery process |
| n8n configuration backup and restore | External n8n platform | @genesis-runtime | Flow export/backups and restore test record | Not available in repository | Cannot certify integration recovery timings |
| DNS recovery controls | External DNS provider | @genesis-runtime | DNS config export + failover/recovery validation logs | Not available in repository | Traffic recovery path remains conditional |
| SSL certificate recovery/rotation controls | External certificate manager | @genesis-security | Cert inventory, renewal logs, recovery procedure evidence | Not available in repository | Secure endpoint recovery remains conditional |
| Reverse proxy/edge routing recovery controls | External edge/proxy platform | @genesis-runtime | Routing config snapshot and recovery validation | Not available in repository | End-to-end service restoration remains conditional |
| Production compute platform recovery controls | External hosting platform | @genesis-runtime | Host/service restore runbook and test evidence | Not available in repository | Runtime RTO cannot be certified |
| Release artifact retention and recovery | External SCM/CI platform | @genesis-build | Retention policy and recovery drill evidence | Not available in repository | Release continuity remains conditional |

## 3. External Evidence Collection Priority

Priority 1 (blocking):
1. PostgreSQL backup/restore/PITR evidence
2. Secrets recovery evidence
3. Runtime hosting recovery evidence

Priority 2 (high):
1. n8n recovery evidence
2. DNS/SSL/proxy recovery evidence

Priority 3 (supporting):
1. CI/release artifact continuity evidence

## 4. Certification Note

A-02 can be approved at documentation level with conditions, but cannot be unconditionally certified for production recovery readiness until external evidence rows above are populated with verifiable records and dates.
