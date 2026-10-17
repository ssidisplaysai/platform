# Production PostgreSQL Application Principal

## Scope

This record captures provisioning of a dedicated least-privilege PostgreSQL runtime principal for production.

- Environment: `production`
- DB instance: `genesis-production-postgres`
- DB endpoint: `genesis-production-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com`
- DB name: `genesis`
- Runtime rebinding status: **rebound to app secret (`genesis-production-web:91`)**

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
- Granted: `USAGE` on schema `public`
- Granted table privileges:
  - `SELECT` on `public.genesis_foundation_state`
  - `INSERT` on `public.genesis_foundation_state`
  - `UPDATE` on `public.genesis_foundation_state`
  - `SELECT`, `INSERT`, `DELETE` on `public.operator_state_pages`
  - `SELECT`, `INSERT`, `DELETE` on `public.operator_state_jobs`
  - `SELECT`, `INSERT`, `DELETE` on `public.operator_state_approvals`
  - `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `public.media_registry_assets`

## Explicitly Absent Privileges

- Database `CREATE`: denied
- `public` schema `CREATE`: denied
- Superuser/admin role membership (`rds_superuser`): denied
- `CREATEDB`: denied
- `CREATEROLE`: denied
- `REPLICATION`: denied
- `BYPASSRLS`: denied

No destructive table privileges were granted.

## Foundation Schema/Grant Phase Status

- Foundation table (`public.genesis_foundation_state`): present.
- Migration metadata table (`public.genesis_schema_migrations`): present.
- Business namespace rows: `0` (none present).
- Status: `PASS` after bounded production migration runner execution and grant verification.

## Functional Certification (Rolled Back)

One bounded certification transaction was executed as `genesis_app` using strict TLS and the dedicated app secret:

- `BEGIN`
- `SELECT` baseline row count
- `INSERT` unique certification namespace
- `UPDATE` same row using revision predicate (`revision = 0`)
- `SELECT` row verification (`revision=1`, `schema_version=1`, JSON object payload)
- `ROLLBACK`

Post-rollback checks confirmed:

- certification namespace rows remaining: `0`
- total foundation rows: `0`

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

## ECS Runtime Binding (Applied)

The production runtime execution role now includes:

- `Action`: `secretsmanager:GetSecretValue`
- `Resource`: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/postgres-app-Hpm0Rc`

Validation by IAM simulation confirmed:

- app secret read: `allowed`
- production admin DB secret read: `implicitDeny`
- staging app secret read: `implicitDeny`

Production web runtime moved from `genesis-production-web:90` to `genesis-production-web:91` with credential-only DB secret rebinding.

## Post-Rebind Remediation Notes

- Root cause for runtime fault was missing `genesis_app` privileges on operator/media runtime tables used by the live page-factory postgres repositories.
- Temporary inline IAM policy `MigrationSecretAccessPatch20261012` on web execution role was removed.
- Final web execution-role DB-secret scope is app-secret only; admin DB secret is no longer readable (`implicitDeny` by simulation).
- `genesis_app` role posture remains least-privilege:
  - `LOGIN=true`
  - `SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS=false`
  - `public` schema `CREATE=false`
  - no unexpected role memberships
