# Production RDS Change Role

## Purpose

`GenesisProductionRdsChangeRole` is the dedicated scoped principal for approved production RDS infrastructure changes on:

- `arn:aws:rds:us-west-2:452630323448:db:genesis-production-postgres`

It exists to prevent use of broad admin sessions for routine production RDS modifications.

## Role

- Role name: `GenesisProductionRdsChangeRole`
- Role ARN: `arn:aws:iam::452630323448:role/GenesisProductionRdsChangeRole`
- Path: `/`

## Trust Policy

This role can be assumed only by the exact production SSO source role:

- `arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f`

No root trust, wildcard trust, external account trust, or service-principal trust is configured.

## Permissions Policy

- Policy name: `GenesisProductionRdsChangePolicy`
- Policy ARN: `arn:aws:iam::452630323448:policy/GenesisProductionRdsChangePolicy`
- Type: customer-managed IAM policy attached to the role

Allowed mutation:

- `rds:ModifyDBInstance` on exactly:
  - `arn:aws:rds:us-west-2:452630323448:db:genesis-production-postgres`

Allowed read-only APIs (resource `*` only because describe APIs are account-level/list-style in practice):

- `rds:DescribeDBInstances`
- `rds:DescribePendingMaintenanceActions`
- `rds:DescribeDBSnapshots`
- `rds:DescribeDBSubnetGroups`
- `rds:DescribeEvents`
- `rds:DescribeOrderableDBInstanceOptions`

## Explicitly Not Granted

Not granted by this policy:

- `rds:CreateDBInstance`
- `rds:DeleteDBInstance`
- `rds:RestoreDBInstance*`
- `rds:CreateDBSnapshot`
- `rds:DeleteDBSnapshot`
- `rds:ModifyDBCluster`
- `rds:ModifyDBSubnetGroup`
- `rds:AddRoleToDBInstance`
- `rds:RemoveRoleFromDBInstance`
- any `iam:*` mutation
- any `secretsmanager:*` mutation
- any `kms:*` mutation
- any `ec2:*` mutation
- any `ecs:*` mutation

## Operational Requirement

Before any approved production RDS modification (for example a future Multi-AZ scheduling action), operators must:

1. assume `GenesisProductionRdsChangeRole`,
2. verify caller identity is the assumed role ARN,
3. execute only the explicitly approved RDS change,
4. retain pre/post evidence and alarm/health checks.

If assumption fails or authorization is denied, stop and resolve the principal issue before any production RDS mutation.
