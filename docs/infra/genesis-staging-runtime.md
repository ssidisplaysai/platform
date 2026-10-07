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
