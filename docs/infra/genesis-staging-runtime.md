# Genesis Staging Runtime (staging only)

Scope: the Share-to-Grow WooCommerce staging proof. Production is only ever read (`describe-*`).
No automated payouts are authorized.

## Resources (all staging-named)
| Resource | Name |
|---|---|
| ECR (immutable tags) | `genesis-staging-runtime` |
| Log group (30d) | `/genesis/staging/web` |
| Secret | `genesis/staging/woocommerce-webhook-secret` (random value generated inside AWS; never in git) |
| Execution role | `genesis-staging-execution-role` (ECS exec policy + read of the one secret) |
| Task security group | `genesis-staging-web-sg` (new, same VPC): ingress tcp/3000 from the same ALB security group(s) the production task SG allows; egress all. Never the production task SG |
| EFS (encrypted, backups on) | `genesis-staging-persistence`, SG `genesis-staging-efs` (tcp/2049 **only** from `genesis-staging-web-sg`; any other NFS source is revoked), access point `/genesis-staging-persistence` uid/gid 1000 |
| Task definition | family `genesis-staging-web`, container `GenesisWebRuntime`, 512 CPU / 1024 MiB, Fargate X86_64 awsvpc |
| ECS service | `genesis-staging-web` in cluster `genesis-production`, desired 1, min 0% / max 100%, no public IP, grace 60s, circuit breaker with rollback |
| Target group | existing `genesis-staging-web`; health check HTTP, traffic-port, `/api/health`, 200 |
| Listener rules | on the existing HTTPS:443 listener (see below) |

Reused read-only from production: cluster, VPC, subnets, task role, ALB and listener. The production task security group is only read, to derive which ingress to mirror.

## Runtime configuration parity (reviewed allowlist)
`infra/staging/runtime-env-allowlist.json` is the reviewed, fail-closed allowlist applied to `genesis-production-web:38`
(container `GenesisWebRuntime`). `provision.sh mode=plan` prints production variable NAMES, secret NAMES and source ARNs
(never values), the task/execution role ARNs, and the disposition of each: `copy`, `overridden-by-staging`, `denied`,
`excluded-review-required`, `excluded-non-loopback` or `unclassified-excluded`. Only `copy` entries are carried into the staging task definition.
- Always set by staging: `NODE_ENV`, `GENESIS_ENVIRONMENT=staging`, `GENESIS_STONER_GYM_RECRUITED_CREATORS=jessica`, `GENESIS_WOOCOMMERCE_WEBHOOK_SECRET` (staging secret), `GCP_FOUNDATION_PERSISTENCE_DIR`, `GIT_COMMIT`, `GENESIS_RUNTIME_SHA`, staging log group, digest-pinned staging image.
- Denied: production persistence path, WordPress bridge credentials, anything matching password/WordPress/DB/payout/payment/webhook/AWS patterns.
- Review-required secrets (not copied until a human moves them into `secrets.allow`): `GENESIS_OPENAI_API_KEY`, `OPENAI_API_KEY`, `GENESIS_CREDENTIAL_MASTER_KEY`. Share-to-Grow does not need them.
- Any copied secret is referenced by ARN; the staging execution role is granted read on exactly those ARNs (production secret values and policies are not modified).

## EFS persistence bridge (STAGING ONLY)
Mounted at `/mnt/genesis-persistence`; `GCP_FOUNDATION_PERSISTENCE_DIR=/mnt/genesis-persistence/foundation`.
Genesis persists Share-to-Grow state as lock-protected JSON files, so **desired count must stay 1**
(deploys use max 100% / min 0% so two tasks never overlap). This is a temporary bridge for the staging proof,
**not** the production ledger architecture. PostgreSQL/RDS is required before Share-to-Grow production certification.

## Listener rules (priority numbers are lower = evaluated first; default action untouched)
| Priority | Conditions (ALL) | Actions |
|---|---|---|
| 10 | host `staging.glwplatform.com` AND path `/api/share-to-grow/woocommerce/webhook` AND method `POST` | forward -> `genesis-staging-web` (no Cognito: WooCommerce cannot do a browser login) |
| 11 | host `staging.glwplatform.com` | authenticate-cognito (copied verbatim from the listener default action; refuses to run if absent) then forward -> `genesis-staging-web` |

The webhook is protected by Genesis HMAC (`x-wc-webhook-signature`): missing/invalid signature => 401 before any persistence.
All other staging paths (and non-POST to the webhook path) require Cognito.
Recommendation (not implemented): attach a WAF web ACL with a rate-based rule scoped to that exact path.

**Open item:** the Cognito app client must list `https://staging.glwplatform.com/oauth2/idpresponse` as a callback URL
for browser login on staging to complete. This changes Cognito configuration and is deliberately not automated here.

## Workflows (`workflow_dispatch` only, OIDC role `GenesisGitHubDeployRole`)
1. `Genesis Staging Infrastructure` - `mode=plan` (read-only) then `mode=apply` with `confirm=APPLY-STAGING`.
2. `Genesis Staging Deploy` - renders the task definition via `provision.sh render-taskdef`, tests, lint, build, Docker, digest-pinned task definition, creates/updates only `genesis-staging-web`, waits for stability, proves health and route.

## Rollback
- Service: `aws ecs update-service --cluster genesis-production --service genesis-staging-web --task-definition genesis-staging-web:<previous>` or `--desired-count 0`.
- Ingress: delete listener rules at priorities 10 and 11 (only staging-host rules).
- Remaining staging resources can be deleted independently; EFS data is staging-only. Production is unaffected.

## Pre-deployment hardening (v3)

### Deploy-role policy (proposed, NOT applied)
`infra/staging/iam/*.json` are four customer-managed policies (each < 6144 chars) to attach to `GenesisGitHubDeployRole`:
`01` read-only production inspection, `02` staging compute/network/auth writes, `03` staging EC2/EFS/IAM writes, `04` explicit **Deny** guardrails for production.
- Staging mutations are scoped by ARN (`genesis-staging-*`) or by the `Environment=staging` tag (SG rules, EFS, listener rules).
- The role currently also has AWS full-access managed policies (ECR/ECS/S3/RDS/CloudWatch). Allow statements cannot narrow those; policy `04` (explicit Deny) is what blocks production mutation. Detaching the full-access managed policies once `01-03` are attached is the real least-privilege step.
- Cognito IAM resources are the whole user pool, so a staging-only client scope is not expressible. `UpdateUserPoolClient`/`DeleteUserPoolClient` are therefore NOT granted (create-only) and are explicitly denied.
- `ecs:RegisterTaskDefinition` only supports `*`; it cannot touch the production task definitions (new revisions of other families only), and `ecs:UpdateService` is limited to `genesis-staging-web`.
- The `ec2:*NetworkInterface` actions are required by EFS mount-target creation and cannot be narrowed.
- Not verified until attached and re-simulated by the plan.

### Staging Cognito client
`provision.sh apply` creates `genesis-staging-operators-client` in the existing pool, mirroring the production client's OAuth flow, scopes, IdPs and token validity (read-only). Differences: name, callback `https://staging.glwplatform.com/oauth2/idpresponse`, logout `https://staging.glwplatform.com/`, `GenerateSecret=true`. Apply refuses to guess if the production client is unreadable. Rule 11's `authenticate-cognito` action references the staging client ID; apply refuses if that equals the production client.

### DNS preflight
`plan` (and `apply`) report whether `staging.glwplatform.com` resolves and whether it points at the Genesis ALB. DNS is never modified.

### Dispatcher
`infra/staging/dispatcher/genesis-staging-dispatch.yml.proposed` is the manual dispatcher intended for `main` (inactive here). Allowed ref: `infra/genesis-staging-runtime-v1` only; `apply` needs `APPLY-STAGING`, `deploy` needs `DEPLOY-STAGING`. The infra and deploy workflows expose `workflow_call` plus `workflow_dispatch`. The temporary push trigger is removed.
