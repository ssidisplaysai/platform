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

## Runtime Foundation Scaffolding Phase (Completed)

- Phase status: `SHARE_TO_GROW_RUNTIME_FOUNDATION=PASS`
- Scope executed:
  - dedicated STG ECS SG
  - RDS ingress for STG SG
  - dedicated STG target group
  - dedicated STG log group + metric filters + alarms + dashboard
  - dedicated STG task definition registration
  - bounded one-off DB probe + bounded one-off app boot
  - canonical state recheck and ingress isolation proof

### Pre-Gate

- Caller: `arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert`
- Account/region: `452630323448` / `us-west-2`
- RDS gate: `available`, `MultiAZ=true`, `PendingModifiedValues={}`
- Canonical gate:
  - `schema_version=1`
  - `revision=1`
  - canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- Certified dedicated resources confirmed present at gate:
  - ECR `genesis-share-to-grow-production`
  - execution role `GenesisShareToGrowProductionExecutionRole`
  - task role `GenesisShareToGrowProductionTaskRole`
  - DB secret `genesis/production/share-to-grow/postgres-app`

### Dedicated Security Group

- Name: `genesis-share-to-grow-production-sg`
- ID: `sg-0e76412b38ac2f535`
- VPC: `vpc-05035503df7e142d6`
- Ingress:
  - TCP `3000` from ALB SG `sg-08117e5cf7cef2d09` only
- Egress:
  - TCP `443` to `0.0.0.0/0` (runtime AWS dependency path)
  - TCP `5432` to RDS SG `sg-0ef556836f34707ee`
  - UDP/TCP `53` to VPC CIDR `10.42.0.0/16` (VPC DNS)

### RDS SG Ingress

- RDS SG: `sg-0ef556836f34707ee`
- Added ingress:
  - TCP `5432` source `sg-0e76412b38ac2f535`
  - description: `Genesis Share-to-Grow production PostgreSQL access`
- Existing Page Factory ingress preserved:
  - source `sg-02f456f2dea97f1be` remained present

### Dedicated Target Group

- Name: `genesis-s2g-production`
- ARN: `arn:aws:elasticloadbalancing:us-west-2:452630323448:targetgroup/genesis-s2g-production/55f036c68e053f00`
- Type: `ip`
- Protocol/port: `HTTP:3000`
- Health check:
  - protocol `HTTP`
  - path `/api/health`
  - matcher `200`
  - healthy threshold `2`
  - unhealthy threshold `3`
  - interval `30`
  - timeout `5`
- Deregistration delay: `30s`
- Attachment status:
  - registered targets `0`
  - listener attachments `0`
  - public ingress: none

### Logging + Metrics + Monitoring

- Log group: `/genesis/share-to-grow/production`
- Retention: `30 days`
- Metric filters (namespace `Genesis/ShareToGrow/Production`):
  - `genesis-s2g-prod-persistence-config-failed` -> `AppPersistenceConfigFailed`
  - `genesis-s2g-prod-persistence-connection-failed` -> `AppPersistenceConnectionFailed`
  - `genesis-s2g-prod-persistence-read-failed` -> `AppPersistenceReadFailed`
  - `genesis-s2g-prod-persistence-write-failed` -> `AppPersistenceWriteFailed`
  - `genesis-s2g-prod-persistence-schema-mismatch` -> `AppPersistenceSchemaMismatch`
  - `genesis-s2g-prod-persistence-revision-conflict` -> `AppPersistenceRevisionConflict`
  - `genesis-s2g-prod-persistence-backend-required` -> `AppPersistenceBackendRequiredInProduction`
  - `genesis-s2g-prod-persistence-tls-required` -> `AppPersistenceTlsConfigurationRequiredInProduction`
  - `genesis-s2g-prod-db-auth-permission-failed` -> `AppDbAuthOrPermissionFailed`
- Alarms created (prefix `genesis-s2g-prod-`, all with `treatMissingData=notBreaching`):
  - `genesis-s2g-prod-ecs-livetaskcount-low`
  - `genesis-s2g-prod-alb-unhealthy-hosts`
  - `genesis-s2g-prod-alb-target-5xx`
  - `genesis-s2g-prod-alb-elb-5xx`
  - `genesis-s2g-prod-app-persistence-config-failed`
  - `genesis-s2g-prod-app-persistence-connection-failed`
  - `genesis-s2g-prod-app-persistence-read-failed`
  - `genesis-s2g-prod-app-persistence-write-failed`
  - `genesis-s2g-prod-app-persistence-schema-mismatch`
  - `genesis-s2g-prod-app-persistence-revision-conflict`
  - `genesis-s2g-prod-app-db-auth-or-permission-failed`
- Alarm state classification:
  - pre-service scaffolding alarms currently `OK` due no-data + `notBreaching`
  - classification: `PRECREATED_NOT_ACTIVE`
- Dashboard:
  - name `genesis-share-to-grow-production`
  - widgets `5`
  - includes ECS/TG/ALB custom metrics plus shared RDS context widgets

### Dedicated Task Definition

- ARN: `arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-share-to-grow-production:1`
- Family/revision: `genesis-share-to-grow-production:1`
- Container: `GenesisShareToGrowRuntime`
- Image: `452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-share-to-grow-production@sha256:647cd0557ab9d4e18ff3ec422badde60697c435282583ba8fcab1ed27a0abe2a`
- Roles:
  - task: `arn:aws:iam::452630323448:role/GenesisShareToGrowProductionTaskRole`
  - execution: `arn:aws:iam::452630323448:role/GenesisShareToGrowProductionExecutionRole`
- Size/platform:
  - cpu `512`
  - memory `1024`
  - `X86_64` / `LINUX` / Fargate
- Environment:
  - `NODE_ENV=production`
  - `GENESIS_ENVIRONMENT=production`
  - `GENESIS_STATE_BACKEND=postgres`
  - `GENESIS_RDS_CA_CERT=/app/certs/rds-global-bundle.pem`
  - `PORT=3000`
  - `HOSTNAME=0.0.0.0`
- Secret bindings (`genesis/production/share-to-grow/postgres-app-q3bH9z`):
  - `DB_HOST <- host`
  - `DB_PORT <- port`
  - `DB_NAME <- dbname`
  - `DB_USERNAME <- username`
  - `DB_PASSWORD <- password`
- Woo secret binding: absent (intentional)
- `GENESIS_STONER_GYM_RECRUITED_CREATORS` source audit:
  - read from env with `?? ""` default
  - classification: optional, safe default -> not bound

### Secret Payload Correctness Remediation

- During first one-off run, ECS secret injection failed due legacy non-JSON secret payload format.
- Secret value was normalized to valid JSON (same credential fields/values), enabling ECS key selectors (`:host::`, `:port::`, etc.).
- Secret ARN unchanged: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/postgres-app-q3bH9z`

### One-off Certification Tasks

DB connectivity probe (no writes):

- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/1f99cf05aaa84e579d0accb93c0a6cca`
- Results:
  - `current_user=genesis_share_to_grow_app`
  - `current_database=genesis`
  - strict TLS: pass
  - `SELECT 1`: pass
  - writes: none

Application boot probe (bounded startup):

- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/81b39672bb2144a79db43945ce3a11f7`
- Task was stopped after startup evidence capture (`UserInitiated` bounded stop reason)
- Logs confirmed Next.js startup (`Ready`)
- Not observed in logs:
  - `PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION`
  - `PERSISTENCE_TLS_CONFIGURATION_REQUIRED_IN_PRODUCTION`
  - DB auth failure markers
  - DB permission failure markers
  - secret retrieval failure markers
  - Page Factory dependency markers
- Woo secret required at boot: no

Health proof:

- Public-ingress-free `GET /api/health` probe not safely executed in this phase.
- Status: `DEFERRED` to service phase (task boots and runtime readiness already proven).

### Post-Task Canonical Invariant Recheck

- Namespace: `share-to-grow-repository`
- `schema_version=1`
- `revision=1`
- `md5(data::text)=6a296406fc8beea3bd60e37b073fc53a`
- canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- all eight collection counts remained `0`

### Page Factory No-Drift Confirmation

- No STG-caused mutation was made to Page Factory ECS service/family/ECR/IAM/secrets/ALB routes/DB grants/monitoring/source.
- Observed PF signals during and after phase:
  - service task definition stayed `genesis-production-web:97`
  - PF target group remained `Genesi-Runti-KLFP6LAXADYR`
  - PF alarms remained `15`
  - PF dashboard `genesis-production-operations-baseline` remained present

## Isolated ECS Service Certification Phase (Completed)

- Phase status: `SHARE_TO_GROW_PRODUCTION_SERVICE=PASS`
- Service: `genesis-share-to-grow-production`
- Cluster: `genesis-production`
- Task definition: `genesis-share-to-grow-production:1`
- Security group: `sg-0e76412b38ac2f535`
- Subnets: `subnet-00a0b287895a3b18c`, `subnet-0f303dea5f645e42d`

### Important Service-Creation Constraint and Approved Override

- ECS rejected load-balanced service creation while target group had no ALB association:
  - `InvalidParameterException: target group ... does not have an associated load balancer`
- This phase proceeded under explicit override to:
  - create the service **without** LB attachment
  - defer target-group health certification until ingress association phase

### Service Convergence

- Service ARN: `arn:aws:ecs:us-west-2:452630323448:service/genesis-production/genesis-share-to-grow-production`
- Convergence to `desired/running/pending=1/1/0`: `50s`
- Deployment reached `COMPLETED`
- Active running task ARN:
  - `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/a953ff13d95c4812b7ef9b25053df999`
- Task ENI/IP/AZ:
  - ENI `eni-01b6153493a7820c2`
  - private IP `10.42.2.86`
  - AZ `us-west-2a`

### Application Startup and Error Review

Log stream: `runtime/GenesisShareToGrowRuntime/a953ff13d95c4812b7ef9b25053df999`

- Startup evidence:
  - `▲ Next.js 16.2.10`
  - `✓ Ready in 423ms`
- Not observed:
  - `PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION`
  - `PERSISTENCE_TLS_CONFIGURATION_REQUIRED_IN_PRODUCTION`
  - `PERSISTENCE_DATABASE_CONFIGURATION_INVALID`
  - `PERSISTENCE_TLS_CONFIGURATION_INVALID`
  - `GENESIS_PERSISTENCE_CONFIGURATION_FAILED`
  - `GENESIS_PERSISTENCE_CONNECTION_FAILED`
  - `GENESIS_PERSISTENCE_READ_FAILED`
  - `GENESIS_PERSISTENCE_WRITE_FAILED`
  - `GENESIS_PERSISTENCE_SCHEMA_MISMATCH`
  - `GENESIS_PERSISTENCE_REVISION_CONFLICT`
  - DB auth/permission failures
  - secret retrieval failures

### Runtime Identity Certification

Bounded runtime identity probe task:

- Task ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/23facbf882944db5be4ad900b293b0ff`
- Output proved:
  - backend `postgres`
  - strict CA path `/app/certs/rds-global-bundle.pem`
  - DB principal `genesis_share_to_grow_app`
  - DB `genesis`

### Live Canonical Application Read (Non-SQL-Only)

Mechanism:

- bounded one-off same-image runtime module invocation:
  - `/app/probe-dist/src/modules/foundation/foundation-state-store.js`
- this reads canonical namespace through application persistence adapter (not raw SQL-only proof)

Evidence task:

- ARN: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/0e99da18ec5948b7b394df051eb6e6e5`
- Result:
  - `namespace=share-to-grow-repository`
  - `schemaVersion=1`
  - `revision=1`
  - counts all `0`
  - canonical SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`

### State Immutability (Before/After Service Read)

- Before:
  - `schema_version=1`, `revision=1`
  - `updated_at=2026-10-12 14:46:21.214147+00`
  - SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- After:
  - `schema_version=1`, `revision=1`
  - `updated_at=2026-10-12 14:46:21.214147+00`
  - SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- All eight collection counts unchanged at `0`

### Target Group Isolation in This Phase

- Target group ARN: `arn:aws:elasticloadbalancing:us-west-2:452630323448:targetgroup/genesis-s2g-production/55f036c68e053f00`
- Service LB attachments: none
- TG registered targets: `0`
- Listener attachments/rules to TG: `0`
- DNS: none
- `PUBLIC_STG_INGRESS=NONE`

### STG Alarm Classification (11 Alarms)

- Alarm prefix: `genesis-s2g-prod-`
- States observed: all `OK`, no `ALARM`
- Classification:
  - `genesis-s2g-prod-ecs-livetaskcount-low`: `ACTIVE`
  - `genesis-s2g-prod-alb-unhealthy-hosts`: `PRECREATED_NOT_ACTIVE` (no listener/TG routing yet)
  - `genesis-s2g-prod-alb-target-5xx`: `PRECREATED_NOT_ACTIVE`
  - `genesis-s2g-prod-alb-elb-5xx`: `PRECREATED_NOT_ACTIVE`
  - `genesis-s2g-prod-app-persistence-config-failed`: `ACTIVE` (service/log source active)
  - `genesis-s2g-prod-app-persistence-connection-failed`: `ACTIVE`
  - `genesis-s2g-prod-app-persistence-read-failed`: `ACTIVE`
  - `genesis-s2g-prod-app-persistence-write-failed`: `ACTIVE`
  - `genesis-s2g-prod-app-persistence-schema-mismatch`: `ACTIVE`
  - `genesis-s2g-prod-app-persistence-revision-conflict`: `ACTIVE`
  - `genesis-s2g-prod-app-db-auth-or-permission-failed`: `ACTIVE`

### 15-Minute Stability Window

Window:

- start `2026-10-12T22:23:45.5413961Z`
- end `2026-10-12T22:39:03.5720822Z`
- duration `15 minutes`

Sample summary (4 samples, every ~5 minutes):

- service stayed `1/1/0`
- rollout remained `COMPLETED`
- deployment count remained `1`
- running task ARN unchanged (no restart/replacement)
- RDS remained `available`, `MultiAZ=true`, `PendingModifiedValues={}`
- canonical state hash/revision unchanged after window
- no persistence/auth/secret failure markers observed

### Woo and Payout Safety

- `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET` not bound in service task definition
- no Woo ingress/listener rule created
- `sourceEventReceipts=0`
- `WOO_PRODUCTION_ENABLED=NO`
- `payoutEntitlements=0`
- no payout executor introduced

### Page Factory No-Drift (Service Phase)

- STG-caused PF changes: none
- PF signals remained independently managed (observed task revision advanced independently to `:98` during this period)
- `PAGE_FACTORY_DRIFT_RISK=NO`

## Share-to-Grow Production Health-Only Ingress Phase (AWS-Side Complete; External DNS/Cert Pending)

- Window (UTC): `2026-10-12T23:01:00Z` → `2026-10-12T23:43:00Z`
- Operator direction: proceed with AWS-side setup even though `glwplatform.com` is externally managed DNS
- Result classification: `SHARE_TO_GROW_HEALTH_ONLY_INGRESS=BLOCKED_HEALTH`

### Pre-Gate

- Caller account/region: `452630323448` / `us-west-2`
- Service pre-state: `1/1/0`, rollout `COMPLETED`
- Running task pre-state: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/a953ff13d95c4812b7ef9b25053df999`
- Target group pre-state: registered targets `0`
- Listener priorities pre-state: `10`, `11`, `default` (free: `12`, `13`)
- Woo secret binding in task definition: absent (`DB_*` only)
- Canonical pre-state: `schema_version=1`, `revision=1`, SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`

### Certificate Audit + Provisioning

- HTTPS listener existing certificates:
  - `arn:aws:acm:us-west-2:452630323448:certificate/a2ebdf17-9f32-49a9-aee4-48daa1853ab1` (`app.glwplatform.com`) `ISSUED`
  - `arn:aws:acm:us-west-2:452630323448:certificate/db2e32c3-5c3e-43ff-a3fd-e169d615b7a7` (`staging.glwplatform.com`) `ISSUED`
- Coverage for `share-to-grow.glwplatform.com`: none
- New certificate requested:
  - ARN: `arn:aws:acm:us-west-2:452630323448:certificate/3218d97a-c585-47ab-bbe9-3633e5d44252`
  - Domain: `share-to-grow.glwplatform.com`
  - Status: `PENDING_VALIDATION` (DNS)
  - Validation CNAME name: `_fea44451dbc7bacd728a8edcad25cf94.share-to-grow.glwplatform.com.`
  - Validation CNAME value: `_1d854ad3551f80165b012391846d30e7.wzccmgtwzk.acm-validations.aws.`
- SNI attach attempt while pending returned `UnsupportedCertificate`; attach deferred until cert issuance.

### DNS Authority Findings

- Route53 hosted zone for `glwplatform.com`: none in this account (`external DNS authority`)
- Current public resolution for `share-to-grow.glwplatform.com`: `NXDOMAIN`
- Required external DNS record:
  - type: `CNAME` (or provider-equivalent ALIAS)
  - name: `share-to-grow.glwplatform.com`
  - target: `Genesi-Runti-8hL31AGbz6rt-743202067.us-west-2.elb.amazonaws.com`

### Listener Rule Changes (Health-Only + Catch-All Block)

- Health rule created:
  - ARN: `arn:aws:elasticloadbalancing:us-west-2:452630323448:listener-rule/app/Genesi-Runti-8hL31AGbz6rt/000f8789ed6774c4/b3b1e351dd74f9b7/b46054f01c92042c`
  - priority: `12`
  - conditions: host `share-to-grow.glwplatform.com` AND path `/api/health`
  - action: forward to `genesis-s2g-production`
- Catch-all block rule created first:
  - ARN: `arn:aws:elasticloadbalancing:us-west-2:452630323448:listener-rule/app/Genesi-Runti-8hL31AGbz6rt/000f8789ed6774c4/b3b1e351dd74f9b7/1f8975691236a581`
  - priority: `13`
  - conditions: host `share-to-grow.glwplatform.com`
  - action: fixed response `404`, body `Not Found`
- Page Factory default action remained unchanged:
  - authenticate-cognito + forward to `Genesi-Runti-KLFP6LAXADYR`

### ECS Service Attachment to Dedicated Target Group

- Exactly one `UpdateService` performed to add LB mapping:
  - target group `genesis-s2g-production`
  - container `GenesisShareToGrowRuntime:3000`
- No changes to task definition, desired count, network, SGs, image, env, or secrets
- Running task replacement occurred during deployment (expected on LB attachment):
  - old task: `.../a953ff13d95c4812b7ef9b25053df999`
  - current task: `.../4b9cdd13448749cd942a864867ef5991`
- Target registration post-attach:
  - target IP `10.42.2.136`
  - AZ `us-west-2a`
  - health `healthy`

### Health and Route Isolation Evidence

Public DNS+TLS gate status:

- DNS resolution for `share-to-grow.glwplatform.com`: failed (`NXDOMAIN`)
- strict TLS validation for hostname: failed (cert not yet issued/attached)

ALB-host routed verification (`--resolve`, host preserved):

- `GET /api/health` -> `200` with `{"status":"ok"}`
- `GET /` -> fixed `404` (`Not Found`)
- `GET /api/share-to-grow/woocommerce/webhook` -> fixed `404` (`Not Found`)
- `POST /api/share-to-grow/woocommerce/webhook` -> fixed `404` (`Not Found`)
- `GET /does-not-exist` -> fixed `404` (`Not Found`)
- webhook traffic reached STG application: `NO`

### Application Log Proof

- Active stream during verification: `runtime/GenesisShareToGrowRuntime/4b9cdd13448749cd942a864867ef5991`
- Since ingress test start:
  - `webhook` log matches: `0`
  - `WOOCOMMERCE_WEBHOOK_SECRET_NOT_CONFIGURED` matches: `0`
  - persistence/db/secret failure markers during stability window: `0`

### Canonical State Immutability (Post-Ingress)

- Verified after ingress tests via bounded same-image probe task:
  - `schema_version=1`
  - `revision=1`
  - `updated_at=2026-10-12 14:46:21.214147+00`
  - SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
  - all 8 collection counts remained `0`
- `sourceEventReceipts=0`, `processedCommerceLines=0`, `payoutEntitlements=0`

### Alarm and Stability Certification

- Alarms (`genesis-s2g-prod-*`): `11 OK`, `0 ALARM` at certification close
- 15-minute stability window:
  - start `2026-10-12T23:25:25.7210076Z`
  - end `2026-10-12T23:41:53.7255569Z`
  - duration `16.47 minutes`
  - four samples at ~5-minute cadence all showed:
    - service `1/1/0`, rollout `COMPLETED`
    - same running task ARN (no restarts)
    - target `healthy`
    - health endpoint `200`
    - host catch-all/webhook block `404`
    - no persistence/db/secret errors
    - RDS `available`, `MultiAZ=true`, `PendingModifiedValues={}`

### Woo / Payout Safety and PF Boundary

- `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET` still unbound
- public Woo path remains ALB-blocked
- `WOO_PRODUCTION_ENABLED=NO`
- payout automation unchanged/disabled
- Page Factory ECS/task/ECR/IAM/secrets/TG/default action/DNS/DB/monitoring/source: unchanged
- `PAGE_FACTORY_DRIFT_RISK=NO`

### Exit Condition for PASS

To move from `BLOCKED_HEALTH` to `PASS`, external operations must complete:

1. create external DNS record for `share-to-grow.glwplatform.com` to ALB DNS target
2. create ACM validation CNAME for the pending certificate
3. wait for ACM certificate status `ISSUED`
4. attach issued cert to HTTPS listener as additional SNI certificate
5. rerun strict public HTTPS checks against `https://share-to-grow.glwplatform.com/api/health`

### Completion Update (PASS)

External DNS propagation and ACM validation completed, then final gate checks were rerun.

- ACM certificate `arn:aws:acm:us-west-2:452630323448:certificate/3218d97a-c585-47ab-bbe9-3633e5d44252` is now `ISSUED` (`ValidationStatus=SUCCESS`)
- Certificate attached to production HTTPS listener as additional SNI cert
- Public DNS now resolves:
  - `share-to-grow.glwplatform.com` -> `genesi-runti-8hl31agbz6rt-743202067.us-west-2.elb.amazonaws.com`
  - `_fea44451dbc7bacd728a8edcad25cf94.share-to-grow.glwplatform.com` -> `_1d854ad3551f80165b012391846d30e7.wzccmgtwzk.acm-validations.aws`
- Strict TLS hostname verification passed (`curl` exit `0` with host-preserving validation)
- Public HTTPS checks passed:
  - `GET /api/health` -> `200` with `{"status":"ok"}`
  - `GET /` -> `404`
  - `GET /api/share-to-grow/woocommerce/webhook` -> `404`
  - `POST /api/share-to-grow/woocommerce/webhook` -> `404`
  - `GET /does-not-exist` -> `404`
- Service/target remained steady:
  - ECS `1/1/0`, rollout `COMPLETED`
  - one healthy target in `genesis-s2g-production` (`10.42.2.136:3000`)
- All 11 `genesis-s2g-prod-*` alarms `OK`, `0 ALARM`
- Canonical state unchanged:
  - `schema_version=1`, `revision=1`
  - `updated_at=2026-10-12 14:46:21.214147+00`
  - SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
  - all collection counts `0`

Final classification update:

- `SHARE_TO_GROW_HEALTH_ONLY_INGRESS=PASS`
