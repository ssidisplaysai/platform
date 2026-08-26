# Production Runtime Identity ACL And Trust Policy

Status: Contract only; not installed

## Invariant

The process being evaluated cannot forge or modify evidence used to establish authority over that process. Unknown ownership, unexpected inheritance, excessive write access, or unverifiable ACL state fails closed.

| Artifact | Writer | Reader | Owner | Runtime | Supervisor | Deployment | Operator | Tamper response |
|---|---|---|---|---|---|---|---|---|
| ProductionReleaseIdentity | Deployment issuer | Supervisor, launcher | Deployment service account | No write | Read only | Create/replace atomically | Read only | Reject release |
| ProductionRuntimeLaunchIdentity | Trusted lifecycle launcher | Supervisor | Lifecycle service account | No write | Read only | Read approved release | Read only | Reject launch |
| ProductionRuntimeInstanceIdentity | Trusted lifecycle launcher | Supervisor | Lifecycle service account | No write | Read only | No write | Read only | Reject instance |
| Ownership epoch and lease | Lifecycle coordinator | All lifecycle participants | Lifecycle service account | No access | Read only for OA-01 | Governed read/write | Governed read/write | Reject and require reconciliation |
| Verification audit | Future audit writer | Operations and auditors | Operations service account | No write | Append only | No rewrite | Read only | Reject verification if append fails |
| Task definition | Governed installer | OA-01 task reader | Administrators/lifecycle account | No write | Read only | Governed install | Read only | Reject installed task |
| Startup script | Deployment installer | Task and verifier | Deployment service account | Read/execute only | Read only | Governed install | Read only | Reject hash mismatch |
| Production release directory | Deployment | Runtime, verifier | Deployment service account | Read/execute only | Read only | Governed write | Read only | Reject path or ACL mismatch |

Descriptor content hashes provide integrity comparison, not authentication. Trust requires an approved issuer, canonical path, expected owner, explicit ACL, current epoch, and live evidence. Raw environment variables, credentials, tokens, connection strings, and `DATABASE_URL` are forbidden from descriptors and audit records.

OA-00A applies no ACL and grants no host authority.