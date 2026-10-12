# Share-to-Grow Production Hardening — 2026-10

## Production RDS Multi-AZ Scheduling Evidence

- Timestamp (local): `2026-10-11T18:50:53.6900748-07:00`
- Applying role ARN: `arn:aws:sts::452630323448:assumed-role/GenesisProductionRdsChangeRole/ScheduleMultiAzDeferred`
- Caller identity ARN: `arn:aws:sts::452630323448:assumed-role/GenesisProductionRdsChangeRole/ScheduleMultiAzDeferred`

### Target DB

- DB identifier: `genesis-production-postgres`
- Pre-state MultiAZ: `false`
- Scheduled target state: `MultiAZ=true`
- applyImmediately: `false` (`--no-apply-immediately`)
- Maintenance window: `tue:12:15-tue:12:45`

### Accepted Pending Modification

- `PendingModifiedValues.MultiAZ=true`
- Current `MultiAZ=false` (expected until maintenance window apply)
- RDS status after scheduling: `available`

### Unchanged DB Properties After Scheduling

- Engine/version: `postgres 16.13`
- Instance class: `db.t4g.micro`
- Allocated storage: `20` GiB
- Storage type: `gp3`
- Subnet group: `genesisfoundationstack-genesispostgressubnetgroup91e30356-zpynhgzxmpua`
- VPC security groups: `sg-0ef556836f34707ee`
- Parameter group: `default.postgres16`
- Storage encryption: `enabled`
- Deletion protection: `enabled`
- Backup retention: `7` days
- Public accessibility: `false`

### Application/Alarm Postcheck After Scheduling

- ECS service: `genesis-production-web`
- Task definition: `genesis-production-web:86`
- desired/running/pending: `1/1/0`
- rollout state: `COMPLETED`
- Target health: `healthy`
- Alarms `genesis-prod-*`: `15 OK`, `0 ALARM`, `0 INSUFFICIENT_DATA`

### Notes

- A short-lived non-service ECS task (`genesis-private-migration-runtime:5`) was observed during this window with `MIGRATION_MODE=verify-only`; it exited and no non-service running tasks remained after scheduling.
- No secret values are recorded in this artifact.

## Production Foundation Schema/Grant Phase Attempt (Blocked)

- Timestamp (local): `2026-10-11T20:09:45-07:00`
- Target DB: `genesis-production-postgres` / `genesis`
- RDS status during gate: `available`, `MultiAZ=true`, `PendingModifiedValues={}`
- Alarms during gate: `15 OK`, `0 ALARM`

### Precheck Findings

- `public.genesis_foundation_state`: absent
- `public.genesis_schema_migrations`: absent
- Foundation row count: `0`
- Business namespace rows (`share-to-grow-repository`): `0`

### Migration Execution Attempt

- Mechanism: bounded one-off ECS task in private subnets (no public IP), task definition `genesis-private-migration-runtime:5`
- Attempted canonical command: `node scripts/migrate-foundation-state.mjs up`
- Result: failed (`MODULE_NOT_FOUND`) because `/workspace/scripts/migrate-foundation-state.mjs` is not present in the current production runtime image lineage.
- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/6b9ed4ad8a194104892a7d66d91beb07`

### Runtime Drift Noted During Phase

- Live production service was observed at `genesis-production-web:90` (not `:88`) while remaining healthy (`1/1/0`, `COMPLETED`, target healthy).
- No service update was performed by this phase.

### Phase Classification

- `PRODUCTION_FOUNDATION_SCHEMA_AND_GRANTS=BLOCKED_MIGRATION`
- Reason: canonical migration source/framework required for approved production foundation migrations is not present in the current production runtime image path used by existing bounded migration tasks.
