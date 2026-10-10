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

Reused read-only from production: cluster, VPC, subnets, ALB and listener. The production task role is NOT reused (see below). The production task security group is only read, to derive which ingress to mirror.

## Runtime configuration parity (reviewed allowlist)
`infra/staging/runtime-env-allowlist.json` is the reviewed, fail-closed allowlist applied to the current
`genesis-production-web` service task definition (container `GenesisWebRuntime`). `provision.sh mode=plan` captures its
full ARN as a per-run snapshot, validates the reviewed task/runtime/network/image invariants, and confirms the service
still uses that ARN immediately before reporting plan success. It prints production variable NAMES, secret NAMES and source ARNs
(never secret values), the task/execution role ARNs, and the disposition of each: `copy`, `overridden-by-staging`, `denied`,
`excluded-review-required`, `excluded-non-loopback` or `unclassified-excluded`. Only `copy` entries are carried into the staging task definition.
Production commit provenance is reported separately; missing repository history requires review but does not by itself
fail the infrastructure safety gate.
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

## Share-to-Grow WooCommerce audit (STAGING ONLY)
`GET /api/share-to-grow/audit/woocommerce-order?orderId=<positive-integer>` reads the existing Share-to-Grow repository
views and is available only when `GENESIS_ENVIRONMENT=staging`. It requires the ALB Cognito identity header and is routed
by the existing authenticated staging-host rule (priority 11); it has no unauthenticated listener exception. An optional
`receiptId=<exact-delivery-id>` selects one WooCommerce receipt. Unknown query parameters are rejected.

The response is order-line scoped and excludes raw payloads, secrets, and unrelated records. It reports receipts,
processed lines, allocations derived from the stored economic rule and ledger, ledger entries, pending/paid lifecycle
state, and economic effect counts. It is read-only and does not expose arbitrary file access. The repository does not
store product IDs, campaign IDs, WooCommerce order status, or an order ID on source receipts. Therefore those values
are reported as unavailable; receipt-only association requires the caller to supply the exact receipt ID and is explicitly
marked as caller-supplied. If unlinked WooCommerce receipts exist without a selected receipt ID, the result is
`RECEIPT_ASSOCIATION_UNKNOWN`, not a clean-baseline claim. Repeated delivery attempts themselves are not persisted;
the audit can verify that the canonical line still has one economic effect after a caller observes a replay response.

`WOOCOMMERCE_ORDER_ELIGIBILITY_GATE=IMPLEMENTED`. No payout is initiated by the audit route or by any webhook path.
**NO AUTOMATED EXTERNAL PAYOUTS.**

### Order eligibility
Economics post only for orders with status `processing` or `completed`, a valid `date_paid_gmt`, a total greater than
zero, and no refunds. Any other `order.created`/`order.updated` (pending, on-hold, failed, cancelled, refunded, draft,
unpaid) is acknowledged with HTTP 200, `economicDisposition=ignored_ineligible` and a reason
(`ORDER_STATUS_INELIGIBLE`, `ORDER_NOT_PAID`, `ORDER_TOTAL_INVALID`, `ORDER_HAS_REFUNDS`). Only the signed receipt is
persisted; no processed line, ledger entry or entitlement is written. The signature is verified first and eligibility is
evaluated before cost metadata is required, so unpaid orders without cost meta do not fail. A later paid update of the
same order is processed normally; a repeat delivery for an already-processed line is a `replay` with no new economics.

### Cancellation and refund reversals (append-only)
- `order.cancelled`, `order.updated` with `status: "cancelled"` (see below) and `refund.created` webhooks are handled.
- A full reversal appends one `reversal` ledger entry per original earning (id/idempotency key `reversal:<earningId>`,
  negated amount, `sourceEntryId` = original earning). Original entries are never edited or deleted. Net = original +
  reversal = 0. At most one reversal exists per earning regardless of how many cancel/refund deliveries arrive, and a
  cancelled order cannot be resurrected by later order updates.
- Refunds are idempotent by `refund:<orderId>:<refundId>` and tracked cumulatively per line against the persisted
  `saleMerchandiseMinor`. Cumulative full coverage reverses everything; over-refunds fail closed.
- Entitlements move to the new `reversed` state (from pending/cleared) and can never become payable. If an entitlement
  is already payable or paid the result is `manual_review_required` and nothing is written (no clawback).
- Commerce adjustments are stored in the new `commerceAdjustments` collection; state persisted before this change
  loads with an empty collection. Lines processed before this change lack `saleMerchandiseMinor`, so refunds on them go
  to manual review.
- The audit now reports adjustments plus `originalDmp`, `reversedDmp`, `netDmp` and per-beneficiary gross, reversed and
  net earnings per line and per order.

### Partial refund policy v1 (`PARTIAL_REFUND_COST_POLICY=APPROVED_V1`)
- Customer refunds reduce revenue first. Incurred costs (COGS, inbound freight/duty, fulfillment/packaging, payment
  processing) remain incurred; `PARTIAL_REFUND_COST_RECOVERY=AFFECTS_NONE` until an explicit cost-credit event exists.
- Cumulative participant reversal per line = min(cumulative customer refund, original DMP). A full cumulative refund
  reverses only the remaining unreversed earnings (never another full amount).
- Reversals use the sale's original locked rule (persisted `ruleSnapshot`; legacy lines fall back to the reference rule
  with the same id) and integer minor units with the original residual-beneficiary strategy. Each beneficiary is capped
  at its remaining earning, so participant net earnings never go below zero and no negative entitlement is created.
- Refund beyond original DMP is brand loss, absorbed by STONER outside the participant ledger (no collaborator debt).
- Dispositions: `partially_reversed`, `reversed` (net DMP 0), `reversed_with_brand_loss` (refund exceeded remaining DMP
  without being a full refund), `already_reversed` (no new reversal), `replay`, `manual_review_required`.
- Result fields: `customerRefundAmount`, `economicReversalAmount`, `remainingNetDmp`, `brandLossAmount` (this refund)
  plus cumulative equivalents. Adjustments persist per-line original DMP, cumulative refund/reversal, remaining DMP,
  brand loss and rule version id. Refund identity is `refund:<orderId>:<refundId>`; a different delivery of the same refund
  is a no-op. Refunds above the line sale amount fail closed (`REFUND_EXCEEDS_LINE_SALE`).
- Pending/cleared entitlements are reduced by partial reversals (state `reversed` at zero). Payable/paid entitlements
  return `manual_review_required` with `REFUND_AFTER_PAYOUT_THRESHOLD`: no clawback, no debit, no payout mutation.
- Audit adds per-line and per-order `originalDmp`, `customerRefunded`, `economicReversed`, `netDmp`, `brandLoss`, and
  per-beneficiary `grossEarning`, `reversedAmount`, `netEarning`.
- Only merchandise line items participate. `TAX_REFUND_POLICY=OUT_OF_SCOPE_V1`,
  `CUSTOMER_SHIPPING_REFUND_POLICY=OUT_OF_SCOPE_V1`, `CHARGEBACK_POLICY=OUT_OF_SCOPE_V1`. A refund with no merchandise
  lines is `ignored_no_economics`.
- **NO AUTOMATED EXTERNAL PAYOUTS.**

### Cancellation via `order.updated` and the Woo refund bridge
- `ORDER_UPDATED_CANCELLED_REVERSAL=IMPLEMENTED`: a signed `order.updated` whose payload `status` is `cancelled` is routed to
  the same cancellation operation as the explicit `order.cancelled` topic (which is retained). It is never processed as a
  normal order and no longer reported as `ignored_ineligible`. Other `order.created`/`order.updated` ineligibility is unchanged.
- Cancellation identity is order-scoped (`cancellation:<orderId>`), not delivery-scoped: any later cancelled delivery,
  from either path, is a `replay`. Reversal ids stay `reversal:<earningId>:<adjustmentId>`, so no earning is reversed twice,
  and a cancellation after a full refund reverses nothing further.
- `order.updated.refunds[]` lists refund ids and aggregate totals but not the original order line for each refund line, so
  Genesis never derives line-level refund economics from it (no guessed or proportional allocation).
- Refunds arrive as `refund.created`, sent by `integrations/wordpress/genesis-share-to-grow/` (WordPress plugin; hook
  `woocommerce_refund_created`; HMAC with the existing "Genesis Share-to-Grow Staging" webhook secret read through
  WooCommerce; delivery id `woo-refund-<orderId>-<refundId>`; bounded Action Scheduler retries). See its README. The
  bridge is not deployed by any workflow here; no extra Woo webhooks are needed (keep the single `order.updated` webhook).
- Refund line-item amounts must be entered per order line in WooCommerce; an amount-only refund has no merchandise lines
  and is `ignored_no_economics`.

### Still deferred
Explicit cost recovery events, post-payment clawback, chargebacks/disputes.

`PRODUCTION_IMAGE_PROVENANCE_REVIEW=OPEN`: during the 2026-10-09 staging deploy window production kept task definition
`genesis-production-web:54`, but image `runtime-65088e3-campaign-map-20261009152726` was pushed to the production
repository at about 22:28Z (not by this work; provenance reported `REPOSITORY_NOT_FOUND`). Review before production readiness.

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

## Pre-apply corrections (v4)

### Separate staging task role
Staging runs as `genesis-staging-task-role` (trust `ecs-tasks.amazonaws.com`) with execution role `genesis-staging-execution-role`. The staging task role has **no policies**: the Share-to-Grow receiver only reads environment variables and writes JSON files; the repository has no AWS SDK dependency, and EFS access uses security groups plus the access point (`iam: DISABLED`), not the task role. `provision.sh apply` refuses to proceed if the role ever carries any attached or inline policy, and refuses if it equals the production task role. The production task role (`GenesisRuntimeStack-RuntimeTaskRoleCD4DE6A7-ekuyV7pdb88Q`) is reference information only: `iam:PassRole` for it is removed and explicitly denied by `04-production-guardrails-deny.json`. Grant the staging task role permissions only if inspection proves the running application needs them.

### Deploy-role transition
See [infra/staging/iam/TRANSITION.md](../../infra/staging/iam/TRANSITION.md). Staging apply is not approved while the broad AWS managed policies remain attached.

### Plan: provenance and policy simulation
`plan` now prints only the production image URI, `GIT_COMMIT` and `GENESIS_RUNTIME_SHA` (plus ECR tags/digest/push time), compares any discovered commit with this repository's history (the workflow checks out full history), and reports whether each production-only variable (`GENESIS_STATE_BACKEND`, `GENESIS_RUNTIME_MODE`, `GENESIS_OBJECT_STORE`, `GENESIS_S3_ARTIFACT_BUCKET`, `GENESIS_RDS_CA_CERT`) is referenced by repository code. It also runs `iam:SimulateCustomPolicy` over the proposed policies in isolation with `infra/staging/iam/simulation-cases.json` (allow and deny expectations), which is not affected by whatever is currently attached.

### Actions that cannot be resource-scoped
| Action | Why |
|---|---|
| `ecr:GetAuthorizationToken`, `secretsmanager:GetRandomPassword`, `iam:SimulateCustomPolicy` | AWS does not support resource-level permissions |
| `ecs:RegisterTaskDefinition`, `ecs:DeregisterTaskDefinition` | No resource-level support; task-definition ARNs are unknown before registration. Registering a new family or revision cannot alter `genesis-production-web` revisions, and `ecs:UpdateService` is limited to the staging service |
| `ec2:Describe*`, `elasticloadbalancing:Describe*`, `logs:DescribeLogGroups`, `elasticfilesystem:Describe*` | List/describe actions have no usable resource scope |
| `ec2:CreateNetworkInterface`, `ModifyNetworkInterfaceAttribute`, `DeleteNetworkInterface` | Needed for EFS mount-target creation; ENI IDs are unknown beforehand |
| `ec2:CreateSecurityGroup` | The new group ID is unknown; scoped to the production VPC ARN plus a required `aws:RequestTag/Environment=staging`, so the `security-group/*` resource is a wildcard |
| `elasticfilesystem:CreateFileSystem`, `CreateAccessPoint` | IDs are unknown before creation; scoped by required `aws:RequestTag/Environment=staging` instead |
| `cognito-idp:CreateUserPoolClient` | Scoped to the existing user pool; AWS has no condition key for the client name, so the role could create other clients in that pool (update and delete are not granted and are explicitly denied) |