# Production PostgreSQL Application Principal

## Scope

This record captures provisioning of a dedicated least-privilege PostgreSQL runtime principal for production.

- Environment: `production`
- DB instance: `genesis-production-postgres`
- DB endpoint: `genesis-production-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com`
- DB name: `genesis`
- Runtime rebinding status: **not yet rebound**

## Principal

- Role name: `genesis_app`
- Created via bounded one-off ECS/Fargate admin task: `yes`
- Authentication: `LOGIN`
- Inheritance: `NOINHERIT`

### Role Attributes

- `rolsuper=false`
- `rolcreatedb=false`
- `rolcreaterole=false`
- `rolreplication=false`
- `rolbypassrls=false`
- `rolcanlogin=true`
- `rolinherit=false`

## Granted Privileges

- Granted: `CONNECT` on database `genesis`

## Explicitly Absent Privileges

- Database `CREATE`: denied
- `public` schema `CREATE`: denied
- Superuser/admin role membership (`rds_superuser`): denied
- `CREATEDB`: denied
- `CREATEROLE`: denied
- `REPLICATION`: denied
- `BYPASSRLS`: denied

No table-level or schema-level grants were added in this phase.

## Application Secret

- Secret name: `genesis/production/postgres-app`
- Secret ARN: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/postgres-app-Hpm0Rc`
- Payload keys only: `username`, `password`, `host`, `port`, `dbname`
- KMS: default AWS Secrets Manager key (account default, `KmsKeyId` not explicitly set)
- Tags:
  - `Environment=production`
  - `Application=Genesis`
  - `Purpose=PostgresApplicationRuntime`

The secret does **not** contain admin/master credentials.

## Connectivity Validation (Read-only)

Connectivity was validated using a dedicated one-off ECS/Fargate probe task reading only the app secret and enforcing strict TLS verification against the AWS RDS CA bundle.

Validated statements:

- `SELECT current_user;` => `genesis_app`
- `SELECT current_database();` => `genesis`
- `SELECT 1;` => `1`

No writes, migrations, or schema changes were executed by the probe.

## One-off Task IAM Scope

Two dedicated execution roles were used:

- Admin task execution role: `GenesisProductionDbAdminTaskExecutionRole`
  - Secret read scope: existing production admin DB secret only
- App probe execution role: `GenesisProductionDbAppProbeTaskExecutionRole`
  - Secret read scope: new app secret only

Neither role was attached to the production web service.

## Future ECS Binding Requirement (Not Applied Yet)

For eventual runtime rebinding, production web execution role needs:

- `Action`: `secretsmanager:GetSecretValue`
- `Resource`: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/postgres-app-Hpm0Rc`

No ECS service/task-definition rebinding was performed in this phase.
