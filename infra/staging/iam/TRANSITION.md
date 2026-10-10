# Genesis staging IAM transition

## Administrator-owned IAM changes

`GenesisGitHubDeployRole` must not administer its own authorization. `04-production-guardrails-deny` explicitly denies role-policy mutation against the role. GitHub Actions therefore verifies IAM state but never creates, updates, attaches, or detaches policies.

An AWS administrator must run `infra/staging/admin-bootstrap-iam.sh` manually from an authorized environment containing this repository. The helper is not invoked by GitHub Actions. It:

1. Verifies AWS account `452630323448`, reads `GenesisGitHubDeployRole`, and requires zero inline policies.
2. Accepts only the canonical scoped-only starting set (`01`–`04`) or the already-complete scoped-only set (`01`–`05`). It explicitly rejects any legacy broad AWS-managed policy, missing policy `04`, missing policy `01`/`02`/`03`, or unexpected attachment.
3. Creates or reuses only the five `GenesisStagingDeploy-*` policies. Existing default policy versions must semantically match the corresponding repository documents; mismatches or unreadable state fail without overwrite.
4. If missing, attaches only policy `05`. Policy `04` remains continuously attached while policy `05` is added; it is never detached or reattached.
5. Performs read-only final verification of exactly policies `01`–`05`, zero broad AWS-managed policies, and zero inline policies. The scoped role has five attached managed policies.

The normal bootstrap never detaches policies or changes an existing policy version; it may create and attach policy `05` only. Refresh modes separately update a default policy version as explicitly named. The helper does not apply infrastructure, deploy, or modify Cognito, DNS, load balancers/listeners, or production resources.

For an explicitly approved change to the already-attached production inspection policy only, an AWS administrator can run:

```sh
bash infra/staging/admin-bootstrap-iam.sh --refresh-production-inspection-policy
```

This restricted mode verifies the AWS account, the existing role and attached policy, zero inline role policies, and the proposed read-only document, including the 6,144 non-whitespace-character managed-policy size limit. It creates a new default version only for `GenesisStagingDeploy-01-read-only-production-inspection`; it never attaches/detaches policies or modifies another role or policy. It refuses to delete old policy versions if IAM's five-version limit has been reached. The GitHub OIDC role must not run this mode; policy 04 explicitly blocks self-administration.

The production inspection policy grants only approved read actions. CloudFormation stack reads are scoped to the `GenesisRuntimeStack` stack ARN; `secretsmanager:DescribeSecret` is limited to the referenced production database, OpenAI, and WordPress secrets and never includes `GetSecretValue`. IAM managed-policy metadata reads are limited to the five Genesis staging inspection policies and `GenesisRuntimeStack-*` customer-managed policies; the inspector skips IAM policy-document reads for AWS-managed and unrelated policies rather than requesting out-of-scope access.

Policy 03 and policy 05 have separately validated administrator-only version refresh modes:

```sh
bash infra/staging/admin-bootstrap-iam.sh --refresh-staging-data-policy
bash infra/staging/admin-bootstrap-iam.sh --refresh-staging-postgres-policy
```

Each mode requires the relevant scoped policy to be already attached, requires zero inline policies, verifies the policy document and size, preserves the existing version history, and verifies the newly active default version. It never attaches a policy or modifies runtime resources.

Policy 04 has a separate, stricter administrator-only refresh mode:

```sh
bash infra/staging/admin-bootstrap-iam.sh --refresh-production-guardrails-policy
```

It requires the expected account, existing role, zero inline policies, existing attached policy 04, and the exact reviewed deny-only document (pinned to its reviewed SHA-256 digest). It does not change attachments. If a new version is needed, the mode refuses to proceed at the five-version IAM limit rather than deleting history; after creation it rereads the default document and requires exact semantic equality. Any future policy 04 edit requires reviewing the semantic diff, updating the digest intentionally, and passing the guardrail tests.

ECS `DescribeTasks` and `ListTasks` use `Resource: "*"` with `ArnEquals` on `ecs:cluster` set to the exact `genesis-production` cluster ARN. AWS's ECS IAM examples use this resource/condition pattern to scope task inspection to a cluster; task-resource-only or cluster-resource-only scopes do not authorize the combined API calls used by this inspection. The cluster condition prevents access to staging or unrelated ECS clusters.

Other resource scopes are limited to the production ECR repository and production web log streams. AWS requires `Resource: "*"` for the RDS Describe APIs, `ecs:ListTaskDefinitions`, and `ec2:DescribeRouteTables` because they do not support resource-level permissions. `cloudwatch:DescribeAlarms` uses wildcard resource scope because alarm inventory includes composite alarms. These statements contain no wildcard actions.

Policy `05-staging-postgres-provisioning` owns the isolated PostgreSQL provisioning grants removed from policy `03`. RDS describe APIs use `Resource: "*"` because AWS does not support resource-level authorization for those calls; creation, tagging, subnet-group use, and secret metadata remain scoped to staging resource names and request tags. The RDS service-linked role grant is constrained to `rds.amazonaws.com`.

## Canonical scoped-only role state

The broad-policy transition is complete. The canonical role state contains only Genesis policies `01`–`05`; the five legacy broad AWS-managed policies are forbidden. The normal bootstrap accepts the current four-policy state (`01`–`04`) to add `05`, or the complete five-policy state for an idempotent rerun. Any broad or unrelated policy causes a clear fail-closed error. Policy `04` stays attached throughout the incremental addition of policy `05`; no broad-policy transition or guardrail reordering is performed.

## GitHub verification and read-only plan

The reusable `.github/workflows/genesis-staging-bootstrap.yml` is named **Genesis Staging IAM Verify and Plan**. Despite its historical filename, it is strictly verification plus read-only planning. Through GitHub OIDC using `GenesisGitHubDeployRole`, it:

- verifies the account and role;
- requires zero inline policies;
- requires exactly the five scoped staging policies and rejects the five broad AWS-managed policies and any other managed policy;
- retrieves each staging policy's default version and compares its normalized JSON semantically with the repository file; and
- runs `bash infra/staging/provision.sh plan`, requiring `CUSTOM_POLICY_SIMULATION=PASS` and `GENESIS_STAGING_PLAN_GATE=PASS`.

Missing policy state reports `ADMIN_BOOTSTRAP_REQUIRED`; document differences or unreadable state fail. The workflow contains no IAM mutation calls.

The scoped role and administrator-owned bootstrap prevent GitHub Actions from escalating its permissions, locking itself out mid-run, or rewriting the authorization constraints governing later steps. No change to the existing GitHub OIDC trust policy is part of this design.
