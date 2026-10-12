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

## Isolated ECR + Runtime IAM Phase (Completed)

- Phase scope: dedicated Share-to-Grow image repository and dedicated runtime IAM roles only.
- Baseline caller: `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`
- Baseline preexistence:
  - ECR `genesis-share-to-grow-production`: absent
  - Execution role `GenesisShareToGrowProductionExecutionRole`: absent
  - Task role `GenesisShareToGrowProductionTaskRole`: absent
- Canonical state precheck: `schema_version=1`, `revision=1`, canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`

### Dedicated ECR Repository

- Name: `genesis-share-to-grow-production`
- ARN: `arn:aws:ecr:us-west-2:452630323448:repository/genesis-share-to-grow-production`
- URI: `452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-share-to-grow-production`
- Settings:
  - private repository
  - `scanOnPush=true`
  - `encryptionType=AES256`
  - `imageTagMutability=IMMUTABLE`

### Dedicated Execution Role

- Role: `GenesisShareToGrowProductionExecutionRole`
- ARN: `arn:aws:iam::452630323448:role/GenesisShareToGrowProductionExecutionRole`
- Trust principal only: `ecs-tasks.amazonaws.com`
- Attached managed policy:
  - `arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy`
- Inline policy:
  - `ShareToGrowDbSecretReadOnly`
  - allows only `secretsmanager:GetSecretValue` on:
    - `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/postgres-app-q3bH9z`

### Execution Role Secret Simulation Matrix

- `secretsmanager:GetSecretValue`:
  - STG DB secret: `allowed`
  - Page Factory production postgres-app secret: `implicitDeny`
  - Page Factory OpenAI secret: `implicitDeny`
  - Page Factory WordPress secret: `implicitDeny`
  - production admin/foundation DB secret: `implicitDeny`
  - staging postgres secret: `implicitDeny`
  - staging Woo secret: `implicitDeny`
  - hypothetical future STG Woo secret: `implicitDeny`
- Wildcard match check (`genesis/production/share-to-grow/*`): `implicitDeny`

### Dedicated Task Role

- Role: `GenesisShareToGrowProductionTaskRole`
- ARN: `arn:aws:iam::452630323448:role/GenesisShareToGrowProductionTaskRole`
- Trust principal only: `ecs-tasks.amazonaws.com`
- Managed policies: none
- Inline policies: none

Task-role negative simulation checks (`implicitDeny`):

- `secretsmanager:GetSecretValue` on STG/PF/admin/staging secret targets
- `s3:ListAllMyBuckets`
- `ecs:UpdateService`
- `iam:PassRole`
- `rds:ModifyDBInstance`
- `secretsmanager:ListSecrets`

### Immutable Image Provenance Push (Authorized Optional Step)

- Source commit: `33719ae2efb2e8dca098648e945ae265edd92e5d`
- Dockerfile: repository-root `Dockerfile`
- Build arg: `GIT_COMMIT=33719ae2efb2e8dca098648e945ae265edd92e5d`
- Pushed tag: `s2g-prod-33719ae2-20261012T210232Z`
- Digest: `sha256:647cd0557ab9d4e18ff3ec422badde60697c435282583ba8fcab1ed27a0abe2a`
- Repository: `genesis-share-to-grow-production`
- Push caller: `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`

Image content reconfirmation:

- compiled STG webhook route present:
  - `/app/.next/server/app/api/share-to-grow/woocommerce/webhook/route.js`
- health route present:
  - `/app/.next/server/app/api/health/route.js`
- RDS CA bundle present:
  - `/app/certs/rds-global-bundle.pem`
- Page Factory monorepo indicators absent:
  - `/workspace/apps/web` absent
  - `/workspace/pnpm-workspace.yaml` absent
- Embedded runtime secret env markers: not present

### Post-Phase Invariants

- Canonical row unchanged:
  - `schema_version=1`
  - `revision=1`
  - `md5(data::text)=6a296406fc8beea3bd60e37b073fc53a`
  - canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- Counts unchanged: all eight collections remain `0`
- Web service unchanged by this phase:
  - `genesis-production-web:95`
  - desired/running/pending `1/1/0`
  - rollout `COMPLETED`
