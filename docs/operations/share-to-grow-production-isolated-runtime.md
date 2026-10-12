# Share-to-Grow Production Isolated Runtime

## DB Principal Isolation Phase (Completed)

- Environment: `production`
- Cluster/service safety baseline: `genesis-production-web:95` (`desired/running/pending = 1/1/0`, rollout `COMPLETED`)
- RDS baseline: `genesis-production-postgres` remained `available`, `MultiAZ=true`, `PendingModifiedValues={}`
- Caller: `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`

### Principal Created

- Role: `genesis_share_to_grow_app`
- Attributes:
  - `rolsuper=false`
  - `rolcreatedb=false`
  - `rolcreaterole=false`
  - `rolreplication=false`
  - `rolbypassrls=false`
  - `rolcanlogin=true`
  - `rolinherit=false`

### Grants Applied (Minimum Scope)

- `GRANT CONNECT ON DATABASE genesis TO genesis_share_to_grow_app`
- `GRANT USAGE ON SCHEMA public TO genesis_share_to_grow_app`
- `GRANT SELECT, INSERT, UPDATE ON TABLE public.genesis_foundation_state TO genesis_share_to_grow_app`

Verified absent:

- table `DELETE` privilege: `false`
- schema `CREATE` privilege: `false`

### Secret Created

- Name: `genesis/production/share-to-grow/postgres-app`
- ARN: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/postgres-app-q3bH9z`
- VersionId: `73ec0245-90d6-481c-afc9-0fc682e15dd7`
- Payload keys: `username`, `password`, `host`, `port`, `dbname`
- Tags:
  - `Environment=production`
  - `Application=Genesis`
  - `Purpose=ShareToGrowPostgresApplicationRuntime`

### Strict TLS and Capability Certification

All probes used `sslmode=verify-full` with an RDS certificate chain extracted in-task via OpenSSL before connecting.

- Identity probe as new role:
  - `current_user=genesis_share_to_grow_app`
  - `current_database=genesis`
- Transactional positive probe (rolled back):
  - `BEGIN -> INSERT -> UPDATE(revision predicate) -> SELECT verify -> ROLLBACK`
  - Namespace: `stg-principal-cert-6d380633c705416185d0d1ad75116bf9`
  - Post-rollback row count for probe namespace: `0`
- Negative privilege probes:
  - `DELETE` denied as expected
  - `TRUNCATE` denied as expected
  - `CREATE TABLE` denied as expected
  - `ALTER TABLE ... OWNER TO ...` denied as expected

### Namespace Invariant

Canonical row `share-to-grow-repository` stayed unchanged across the phase:

- Pre: `schema_version=1`, `revision=1`, `md5(data::text)=6a296406fc8beea3bd60e37b073fc53a`
- Post: `schema_version=1`, `revision=1`, `md5(data::text)=6a296406fc8beea3bd60e37b073fc53a`

### Safety Boundary Confirmation

- No production service update was executed.
- Web task definition remained `genesis-production-web:95`.
- No ALB/network/IAM/runtime image/schema migration changes were applied in this phase.
