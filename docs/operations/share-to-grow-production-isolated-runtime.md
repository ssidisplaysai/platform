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

## Share-to-Grow Production Woo Secret + Authentication Certification (Completed)

- Window (UTC): `2026-10-13T01:40:00Z` -> `2026-10-13T02:12:00Z`
- Objective: provision production Woo webhook secret + runtime binding and certify authentication behavior while keeping public Woo ingress blocked.
- Result: `SHARE_TO_GROW_WOO_AUTHENTICATION=PASS`

### Pre-Gate Snapshot

- Service: `genesis-share-to-grow-production` at `1/1/0`, rollout `COMPLETED`
- Task definition pre-state: `genesis-share-to-grow-production:1`
- Target health pre-state: `healthy`
- Health endpoint pre-state: `200` (`{"status":"ok"}`)
- Public Woo route pre-state: GET/POST `/api/share-to-grow/woocommerce/webhook` -> `404`
- Woo secret pre-state: absent (`ResourceNotFoundException`)
- Task definition pre-state: no `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET` binding
- Canonical pre-state:
  - `schema_version=1`, `revision=1`
  - `updated_at=2026-10-12 14:46:21.214147+00`
  - SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
  - all counts `0`

### Woo Secret Creation

- Name: `genesis/production/share-to-grow/woocommerce-webhook`
- ARN: `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/woocommerce-webhook-dU3KMX`
- VersionId: `4aeefdb8-1280-4373-a098-e1fb8090aca9`
- Encryption: default Secrets Manager KMS key (no customer `KmsKeyId` set)
- Tags:
  - `Environment=production`
  - `Application=GenesisShareToGrow`
  - `Purpose=WooCommerceWebhookAuthentication`
- Secret value exposure: none (value not printed/logged/documented)

### Execution Role Scope Update

- Role: `GenesisShareToGrowProductionExecutionRole`
- Inline policy updated: `ShareToGrowDbSecretReadOnly`
- Allowed resources (`secretsmanager:GetSecretValue`) limited to:
  - `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/postgres-app-q3bH9z`
  - `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/woocommerce-webhook-dU3KMX`
- No wildcard grant added.

IAM simulation matrix (execution role):

- STG DB secret: `allowed`
- STG Woo secret: `allowed`
- PF DB secret: `implicitDeny`
- PF OpenAI secret: `implicitDeny`
- PF WordPress secret: `implicitDeny`
- admin DB secret (`rds!db-*`): `implicitDeny`
- staging DB secret: `implicitDeny`
- staging Woo secret: `implicitDeny`
- `Resource=*`: `implicitDeny`

### Task Definition Revision and Service Rollout

- Registered: `genesis-share-to-grow-production:2`
- Diff from `:1` -> `:2`:
  - added secret binding:
    - `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET` -> `arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/share-to-grow/woocommerce-webhook-dU3KMX`
  - no other task-definition field changed
- Image digest unchanged:
  - `452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-share-to-grow-production@sha256:647cd0557ab9d4e18ff3ec422badde60697c435282583ba8fcab1ed27a0abe2a`
- Service update:
  - exactly one `UpdateService` to task definition `:2`
  - old running task: `.../4b9cdd13448749cd942a864867ef5991`
  - new running task: `.../34f21e9e6395455c86b8d3aeee4515f4`
  - convergence: `172s`
  - post-rollout state: `1/1/0`, `COMPLETED`, one deployment
  - target health: `healthy` (`10.42.2.138:3000`, `us-west-2a`)
  - health endpoint: `200`

### Public Woo Route Remains Blocked

- Post-rollout GET `/api/share-to-grow/woocommerce/webhook` -> `404`
- Post-rollout POST `/api/share-to-grow/woocommerce/webhook` -> `404`
- Application reached by blocked requests: `NO`
- CloudWatch scan during verification window:
  - webhook/woocommerce processing markers: `0`
  - `WOOCOMMERCE_WEBHOOK_SECRET_NOT_CONFIGURED`: `0`

### Internal Authentication Certification (No Public Ingress)

Bounded one-off task executed with task definition `:2` (runtime has Woo secret bound) to validate HMAC behavior without invoking commerce processing:

- one-off task: `arn:aws:ecs:us-west-2:452630323448:task/genesis-production/8530346a7f044790b17d82d7124a480b`
- auth-only payload used (unsupported test fixture; no business command path)
- results:
  - missing signature -> authentication fail (`false`)
  - malformed signature -> authentication fail (`false`)
  - wrong signature -> authentication fail (`false`)
  - correct HMAC SHA-256 signature (with configured production secret) -> authentication pass (`true`)
- Source confirmation for constant-time path:
  - `src/modules/share-to-grow/adapters/woocommerce-events.ts` imports `timingSafeEqual` and uses it in `verifyWooCommerceWebhookSignature`.

### Canonical State and Mutation Guard

Before/after auth certification:

- `schema_version=1`
- `revision=1`
- `updated_at=2026-10-12 14:46:21.214147+00`
- SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
- counts unchanged:
  - participants `0`
  - trackingIdentities `0`
  - ruleVersions `0`
  - ledgerEntries `0`
  - sourceEventReceipts `0`
  - processedCommerceLines `0`
  - payoutEntitlements `0`
  - commerceAdjustments `0`

Business mutation during auth certification: `NO`

### Secret Exposure Audit

- Task definition stores ARN reference only (`valueFrom`), not plaintext.
- CloudWatch logs checked for webhook-secret/config leaks: none.
- Command output and documentation contain no secret plaintext.
- Source tree contains no committed secret value.
- `SECRET_EXPOSURE=NO`

### 15-Minute Post-Change Stability

- Window:
  - start `2026-10-13T01:56:02.2275029Z`
  - end `2026-10-13T02:11:28.1630934Z`
  - duration `15.43m`
- Across four samples:
  - ECS stayed `1/1/0`, rollout `COMPLETED`
  - target stayed `healthy`
  - health endpoint stayed `200`
  - public Woo POST stayed `404`
  - STG alarms in `ALARM`: `0`
  - persistence/db/secret errors: `0`
  - no task restarts (same task ARN across window)
  - RDS stayed `available`, `MultiAZ=true`, `PendingModifiedValues={}`

### Woo / Payout / PF Boundary Status

- `WOO_SECRET_READY=YES`
- `WOO_AUTH_CERTIFIED=YES`
- `WOO_PUBLIC_INGRESS_ENABLED=NO`
- Woo events processed: `0`
- `WOO_PRODUCTION_ENABLED=NO` (public ingress still blocked)
- Automated payouts: disabled
- `payoutEntitlements=0`
- STG-caused Page Factory changes: none
- `PAGE_FACTORY_DRIFT_RISK=NO`

Final classification:

- `SHARE_TO_GROW_WOO_AUTHENTICATION=PASS`

## Share-to-Grow Production Woo Ingress + Bounded Lifecycle Canary (Completed)

- Window (UTC): `2026-10-13T02:40:00Z` -> `2026-10-13T03:13:00Z`
- Objective: enable only production Woo webhook path and certify one bounded production canary lifecycle while keeping payouts disabled and Page Factory unchanged.
- Result: `SHARE_TO_GROW_PRODUCTION_WOO_CANARY=PASS`

### Pre-Gate

- Service/task:
  - `genesis-share-to-grow-production`
  - task definition `genesis-share-to-grow-production:2`
  - state `1/1/0`, rollout `COMPLETED`
- Target health: `healthy`
- Health endpoint: `GET /api/health` -> `200 {"status":"ok"}`
- Alarms: all 11 STG alarms `OK`, `0 ALARM`
- Woo secret binding present: `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET`
- Woo auth pre-certification present from prior phase
- Woo public route pre-state: catch-all `404`
- Canonical baseline pre-state:
  - `schema_version=1`, `revision=1`
  - SHA-256 `7fb069e69fc7c273bec8b11df502066ec07bb19f391252018d5ea051afc829ea`
  - all counts `0`

### Woo Listener Rule Enablement

- Created HTTPS listener rule:
  - ARN: `arn:aws:elasticloadbalancing:us-west-2:452630323448:listener-rule/app/Genesi-Runti-8hL31AGbz6rt/000f8789ed6774c4/b3b1e351dd74f9b7/7ce747ea588e30db`
  - priority: `9`
  - conditions:
    - host `share-to-grow.glwplatform.com`
    - path `/api/share-to-grow/woocommerce/webhook`
  - action: forward to STG TG `genesis-s2g-production`
- Existing rules preserved:
  - health rule `12` unchanged
  - host catch-all `13` unchanged
  - PF default rule unchanged (auth + PF TG forward)

### Route Certification

- `GET /api/health` -> `200`
- `GET /` -> `404` fixed
- `GET /does-not-exist` -> `404` fixed
- unsigned Woo POST -> `401 {"error":"MISSING_WOOCOMMERCE_WEBHOOK_SIGNATURE"}`
- unsigned Woo GET -> `405`
- Conclusion:
  - Woo path now reaches STG application (`YES`)
  - non-Woo STG hostname paths remain blocked (`YES`)

### Canary Contract (Source-Derived)

From source/tests (`woocommerce-webhook-http`, payload parsers, partial-refund/cancel tests):

- required headers:
  - `x-wc-webhook-signature` (base64 HMAC SHA-256 over raw body)
  - `x-wc-webhook-topic`
  - `x-wc-webhook-delivery-id`
- order payload fields used:
  - `id`, `status`, `currency`, `total`, `date_paid_gmt`
  - `meta_data` with `_genesis_touch_id`, `_genesis_tracking_identity_id`, `_genesis_partner_id`, `_genesis_campaign_id`
  - `line_items[]` with `id`, `product_id`, `variation_id`, `quantity`, `subtotal`, `total`, and cost meta:
    - `_genesis_cogs`
    - `_genesis_inbound_freight_duty`
    - `_genesis_fulfillment_packaging`
    - `_genesis_payment_processing`
- refund payload fields used:
  - `id`, `parent_id`, `amount`, `date_created_gmt`
  - `line_items[]` with negative `total` and `_refunded_item_id`
- cancellation path used:
  - `order.updated` with `status=cancelled`

### Canary Identifiers and Event Sequence

- canary namespace: `s2g-prod-canary-20261013`
- orders:
  - `91013003` (auth ingress probe, signed success)
  - `91013011` (order + duplicate + partial refund + duplicate + cancellation + duplicate)
  - `91013012` (order + over-refund cap)
- processed receipt IDs:
  - `s2g-prod-canary-20261013-o3-d1`
  - `s2g-prod-canary-20261013-o1-d1`
  - `s2g-prod-canary-20261013-o1-r1`
  - `s2g-prod-canary-20261013-o1-c1`
  - `s2g-prod-canary-20261013-o2-d1`
  - `s2g-prod-canary-20261013-o2-r1`

### Lifecycle Canary Results

- Order event (o1-d1):
  - auth: pass
  - result: `processed`
  - economics: one processed line, one earning allocation (`stoner`, `3700` minor), one pending entitlement
- Duplicate order replay (same delivery/body):
  - result: `replay`
  - no new lines/ledger/entitlements
- Partial refund (o1-r1, `20.00`):
  - result: `partially_reversed`
  - refund summary:
    - customer refund `20.00`
    - economic reversal `20.00`
    - remaining net DMP `17.00`
    - brand loss `0.00`
  - reversal ledger entry: `-2000` minor
- Duplicate refund replay (same delivery/body):
  - result: `replay`
  - no duplicate adjustment/reversal
- Cancellation after partial (o1-c1 via `order.updated status=cancelled`):
  - result: `reversed`
  - remaining reversal exactly once: `-1700` minor
  - order net reduced to zero
- Duplicate cancellation replay (same delivery/body):
  - result: `replay`
  - no duplicate reversal
- Over-refund cap scenario (o2-r1, refund `50.00` on DMP `37.00`):
  - result: `reversed_with_brand_loss`
  - refund summary:
    - customer refund `50.00`
    - economic reversal `37.00` (capped)
    - remaining net DMP `0.00`
    - brand loss `13.00`
  - cap/rejection behavior verified (`reversal` did not exceed original DMP)

### Final State + Invariants

Final canonical snapshot:

- `schema_version=1`
- `revision=7`
- `updated_at=2026-10-13 02:54:11.43932+00`
- SHA-256 `6d856e874630854fcf9a05c59314aab004b9052dd3db474b20a076d64745181d`
- counts:
  - participants `0`
  - trackingIdentities `0`
  - ruleVersions `0`
  - ledgerEntries `6`
  - sourceEventReceipts `6`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `3`

Invariants:

- schema valid: pass
- split bounds valid: pass
- negative amount rule violations: none
- referential integrity: pass
- duplicate receipts: `0`
- duplicate processed lines: `0`
- entitlement consistency: pass
- reversal cap valid: pass
- payout execution absent: pass
- canonical hash reproducible: pass

Canary isolation:

- all persisted receipts are canary IDs (`unexpectedReceiptIds=[]`)
- all processed lines are canary line keys
- all commerce adjustments are canary order IDs
- no staging/PF/non-canary namespace contamination detected

### Payout Safety + Stability + PF Boundary

- automated payouts remain disabled
- no payout provider execution/transfer invocation
- entitlement states: `pending`/`reversed` only

Post-canary 15-minute window:

- start `2026-10-13T02:57:08.7034910Z`
- end `2026-10-13T03:12:36.5030704Z`
- duration `15.46m`
- across four samples:
  - service remained `1/1/0`, `COMPLETED`
  - target remained `healthy`
  - health endpoint remained `200`
  - unsigned Woo POST remained auth-rejected (`401`)
  - alarms in `ALARM`: `0`
  - persistence/db/secret errors: `0`
  - unexpected 5xx markers: `0`
  - no task restarts
  - RDS remained `available`, `MultiAZ=true`, `PendingModifiedValues={}`

Page Factory drift:

- no STG-caused changes to PF ECS/task defs/ECR/IAM/secrets/ALB default/TG/DNS/DB/monitoring/source
- `PAGE_FACTORY_DRIFT_RISK=NO`

Final classification:

- `SHARE_TO_GROW_PRODUCTION_WOO_CANARY=PASS`

## Share-to-Grow Production Canary Governance + Real Onboarding Readiness (Completed)

- Window (UTC): `2026-10-13T03:13:00Z` -> `2026-10-13T03:40:00Z`
- Objective: classify canary governance state, quantify payout exposure, verify real Woo separation, and define onboarding-readiness baseline; execute canonical balancing mutation if exposure remains.
- Result: `SHARE_TO_GROW_CANARY_GOVERNANCE=PASS`

### Baseline + Mutation Outcome

- baseline before mutation:
  - `schema_version=1`
  - `revision=7`
  - `updated_at=2026-10-13 02:54:11.43932+00`
  - counts: participants/tracking/rules `0`, ledger `6`, receipts `6`, processed lines `3`, entitlements `3`, adjustments `3`
- canonical state after balancing mutation:
  - `schema_version=1`
  - `revision=8`
  - `updated_at=2026-10-13 03:24:30.33174+00`
  - counts: participants/tracking/rules `0`, ledger `7`, receipts `7`, processed lines `3`, entitlements `3`, adjustments `4`
- no ECS/ALB/IAM/secret/task-definition changes

### Governance Inventory + Economics

Canary inventory remained isolated under `sourceEventId` prefix `s2g-prod-canary-20261013`:

- receipts: `7`
- processed lines: `3`
- ledger entries: `7` (`3` earnings, `4` reversals)
- payout entitlements: `3` (`0 pending`, `3 reversed`)
- commerce adjustments: `4`

Economic computation from persisted records:

- gross earnings: `11100` minor
- gross reversals: `11100` minor
- net ledger: `0` minor
- cumulative brand loss: `1300` minor
- possible payable exposure:
  - pending `0`
  - cleared `0`
  - payable `0`
  - paid `0`
  - aggregate `0` minor

### Real Woo Event Separation

- non-canary Woo receipts: `0`
- non-canary receipts across all sources: `0`
- `REAL_PRODUCTION_WOO_EVENTS=0`

### Governance Class + Strategy

Governance class: `A` (isolated canary provenance with zero possible payable exposure).

Selected strategy: preserve immutable canary lineage and neutralize the remaining balance through canonical reversal.

Mutation execution in this phase: `YES` (canonical signed Woo refund).

Executed mutation:

- sourceEventId `s2g-prod-canary-20261013-o3-r1`
- adjustmentId `refund:91013003:9101300391`
- line `9101300301` cumulative refund `3700` minor
- realized effect: entitlement `entitlement:...91013003...` transitioned `pending -> reversed`; aggregate possible payable is `0`

### Real Onboarding Readiness Baseline (No Record Creation)

Production onboarding objects remain empty:

- collaboration participants: `0`
- tracking identities: `0`
- economic rule versions: `0`

Source-derived schema requirements confirmed for next onboarding phase:

- `CollaborationParticipantRecord`
- `TrackingIdentityReferenceRecord`
- `EconomicRuleVersion`
- attribution policy anchor `stoner-gym-attribution-30d-v1` (`windowDays=30`)
- payout policy anchor `stoner-gym-standard-30d-v1` (`clearingDays=30`)
- deterministic Woo metadata keys:
  - `_genesis_touch_id`
  - `_genesis_tracking_identity_id`
  - `_genesis_partner_id`
  - `_genesis_campaign_id`

### Safety/Boundary Assertions

- payouts remain disabled
- no payout provider invocation/transfers
- no Page Factory drift
- no secret exposure
- post-mutation checks:
  - ECS `1/1/0`, rollout `COMPLETED`
  - target `healthy`
  - health `200`
  - unsigned Woo POST `401`
  - alarms in `ALARM`: `0`
  - RDS `available`, `MultiAZ=true`, `PendingModifiedValues={}`

Final classification:

- `SHARE_TO_GROW_CANARY_GOVERNANCE=PASS`

## Share-to-Grow Stoner Gym Production Onboarding (Completed)

- Window (UTC): `2026-10-13T03:40:00Z` -> `2026-10-13T03:56:00Z`
- Objective: create first real production Share-to-Grow canonical config objects for STONER GYM and Daniel (no real commerce event, payouts still disabled).
- Result: `SHARE_TO_GROW_STONER_GYM_ONBOARDING=PASS`

### Source Schema + Hierarchy Model

Canonical shapes confirmed from source:

- participants: `CollaborationParticipantRecord`
- tracking identities: `TrackingIdentityReferenceRecord`
- rule versions: `EconomicRuleVersion`

Hierarchy representation is source-supported via participant role + optional `sponsorPartnerId` (creator-only depth guard). No MLM/multi-level extension was introduced.

### Pre-State

- `schema_version=1`
- `revision=8`
- canonical SHA-256 `5ac81450bc69dad98d0f72dca09c30767dba4ad0120810e7283494dc23d56a06`
- counts:
  - participants `0`
  - trackingIdentities `0`
  - ruleVersions `0`
  - ledgerEntries `7`
  - sourceEventReceipts `7`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `4`

### Production IDs + Objects Written

Program and partner IDs:

- program `stoner-gym`
- STONER participant `stoner` (role `brand`)
- Daniel participant `daniel-coffeen` (role `founding_collaborator`)
- tracking identity `tracking-stoner-gym-daniel-coffeen-v1` (slug `daniel-coffeen`)
- rule versions:
  - `stoner-gym-production-organic-v1`
  - `stoner-gym-production-daniel-direct-v1`

### Rule Design + Dry-Run Validation

Persisted splits:

- organic: STONER `100%`
- Daniel direct: STONER `50%`, Daniel `50%`

Recruited creator path (required 50/35/15) validated in memory only with synthetic creator (not persisted), because rule schema requires concrete beneficiary IDs and no real creator participant is approved yet.

Dry-run outputs on DMP `3700` minor:

- organic: STONER `3700`
- Daniel direct: STONER `1850`, Daniel `1850`
- recruited creator synthetic: STONER `1850`, creator `1295`, Daniel `555`

Dry-run status: `PASS`

### Canonical Write Mechanism + Revision Trace

Repository-semantic optimistic revision write flow used on namespace `share-to-grow-repository`.

- raw SQL direct JSON patch: `NO`
- overwrite/delete canary history: `NO`

Revision trace:

- participant `stoner` -> revision `9`
- participant `daniel-coffeen` -> revision `10`
- tracking `tracking-stoner-gym-daniel-coffeen-v1` -> revision `11`
- rule `stoner-gym-production-organic-v1` -> revision `12`
- rule `stoner-gym-production-daniel-direct-v1` -> revision `13`

### Post-State

- `schema_version=1`
- `revision=13`
- `updated_at=2026-10-13 03:53:39.892603+00`
- canonical SHA-256 `ea144a01d7791858da2baf8d99f9e493e56ed29fb052681119d6cb855f7a0b91`
- counts:
  - participants `2`
  - trackingIdentities `1`
  - ruleVersions `2`
  - ledgerEntries `7`
  - sourceEventReceipts `7`
  - processedCommerceLines `3`
  - payoutEntitlements `3`
  - commerceAdjustments `4`

Configuration-only invariants:

- new ledger entries `0`
- new receipts `0`
- new processed lines `0`
- new payout entitlements `0`
- new adjustments `0`
- canary history intact

### Tracking / Link Format

From source (`GENESIS_WORDPRESS_TOKEN_QUERY_KEY`):

- query key: `genesis_attribution`
- token shape: `<base64url-payload>.<base64url-hmac-signature>`
- referral URL shape: `https://<landing-host>/<path>?genesis_attribution=<signed-token>`
- QR payload: same URL string

### Woo Readiness + Payout Safety + Health

- Woo listener for `/api/share-to-grow/woocommerce/webhook`: active
- `DANIEL_ATTRIBUTION_LOOKUP=PASS`
- `DANIEL_DIRECT_RULE_RESOLUTION=PASS`
- real Woo event sent in this phase: `NO`
- `REAL_PRODUCTION_WOO_EVENTS=0`

Payout safety:

- automated payouts enabled: `NO`
- new payout entitlements from phase: `0`
- provider calls: `0`
- external transfers: `0`

Health:

- ECS `1/1/0`, rollout `COMPLETED`
- target `healthy`
- health endpoint `200`
- unsigned Woo POST `401` (expected)
- alarms in `ALARM`: `0`
- RDS `available`, `MultiAZ=true`, `PendingModifiedValues={}`

### Page Factory Boundary

- no STG-caused changes to PF ECS/task definitions/ECR/IAM/secrets/ALB/DNS/DB/monitoring/source
- `PAGE_FACTORY_DRIFT_RISK=NO`

Final classification:

- `SHARE_TO_GROW_STONER_GYM_ONBOARDING=PASS`
