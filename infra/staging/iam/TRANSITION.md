# Genesis staging IAM transition

## Administrator-owned IAM changes

`GenesisGitHubDeployRole` must not administer its own authorization. The role's current broad managed policies do not grant the complete permissions required to create customer-managed policies and attach them to the role. In addition, `04-production-guardrails-deny` explicitly denies role-policy mutation against `GenesisGitHubDeployRole`. GitHub Actions therefore verifies IAM state but never creates, updates, attaches, or detaches policies.

An AWS administrator must run `infra/staging/admin-bootstrap-iam.sh` manually from an authorized environment containing this repository. The helper is not invoked by GitHub Actions. It:

1. Verifies AWS account `452630323448`, reads `GenesisGitHubDeployRole`, requires zero inline policies, confirms all five expected broad policies are attached, and limits the temporary role to AWS's 10 attached-managed-policy maximum.
2. Creates or reuses only the five `GenesisStagingDeploy-*` policies. Existing default policy versions must semantically match the corresponding repository documents; mismatches or unreadable state fail without overwrite.
3. Attaches policies `01`, `02`, `03`, and `05`, then attaches `04-production-guardrails-deny` last when it is not already attached. During an incremental upgrade, an already-attached guardrail is preserved while missing policy `05` is added; it is never detached or weakened.
4. After policy `04` is attached, performs only read-only verification of the temporary transition state: exactly the five broad plus five staging policies and zero inline policies.

The helper never detaches policies, changes an existing policy or version, applies infrastructure, deploys, or modifies Cognito, DNS, load balancers/listeners, or production resources.

For an explicitly approved change to the already-attached production inspection policy only, an AWS administrator can run:

```sh
bash infra/staging/admin-bootstrap-iam.sh --refresh-production-inspection-policy
```

This restricted mode verifies the AWS account, the existing role and attached policy, zero inline role policies, and the proposed read-only document, including the 6,144 non-whitespace-character managed-policy size limit. It creates a new default version only for `GenesisStagingDeploy-01-read-only-production-inspection`; it never attaches/detaches policies or modifies another role or policy. It refuses to delete old policy versions if IAM's five-version limit has been reached. The GitHub OIDC role must not run this mode; policy 04 explicitly blocks self-administration. The no-argument bootstrap behavior remains unchanged.

The production inspection policy grants only approved read actions. CloudFormation stack reads are scoped to the `GenesisRuntimeStack` stack ARN; `secretsmanager:DescribeSecret` is limited to the referenced production database, OpenAI, and WordPress secrets and never includes `GetSecretValue`. IAM managed-policy metadata reads are limited to the five Genesis staging inspection policies and `GenesisRuntimeStack-*` customer-managed policies; the inspector skips IAM policy-document reads for AWS-managed and unrelated policies rather than requesting out-of-scope access.

Policy 03 and policy 05 have separately validated administrator-only version refresh modes:

```sh
bash infra/staging/admin-bootstrap-iam.sh --refresh-staging-data-policy
bash infra/staging/admin-bootstrap-iam.sh --refresh-staging-postgres-policy
```

Each mode requires the relevant scoped policy to be already attached, requires zero inline policies, verifies the policy document and size, preserves the existing version history, and verifies the newly active default version. It never attaches a policy or modifies runtime resources.

ECS `DescribeTasks` and `ListTasks` use `Resource: "*"` with `ArnEquals` on `ecs:cluster` set to the exact `genesis-production` cluster ARN. AWS's ECS IAM examples use this resource/condition pattern to scope task inspection to a cluster; task-resource-only or cluster-resource-only scopes do not authorize the combined API calls used by this inspection. The cluster condition prevents access to staging or unrelated ECS clusters.

Other resource scopes are limited to the production ECR repository and production web log streams. AWS requires `Resource: "*"` for the RDS Describe APIs, `ecs:ListTaskDefinitions`, and `ec2:DescribeRouteTables` because they do not support resource-level permissions. `cloudwatch:DescribeAlarms` uses wildcard resource scope because alarm inventory includes composite alarms. These statements contain no wildcard actions.

Policy `05-staging-postgres-provisioning` owns the isolated PostgreSQL provisioning grants removed from policy `03`. RDS describe APIs use `Resource: "*"` because AWS does not support resource-level authorization for those calls; creation, tagging, subnet-group use, and secret metadata remain scoped to staging resource names and request tags. The RDS service-linked role grant is constrained to `rds.amazonaws.com`.

The ten-policy state is temporary. The final role state contains only the five scoped `GenesisStagingDeploy-*` policies; all five broad AWS-managed policies must be absent.

## GitHub verification and read-only plan

The reusable `.github/workflows/genesis-staging-bootstrap.yml` is named **Genesis Staging IAM Verify and Plan**. Despite its historical filename, it is strictly verification plus read-only planning. Through GitHub OIDC using `GenesisGitHubDeployRole`, it:

- verifies the account and role;
- requires zero inline policies;
- requires exactly the five scoped staging policies and rejects the five broad AWS-managed policies and any other managed policy;
- retrieves each staging policy's default version and compares its normalized JSON semantically with the repository file; and
- runs `bash infra/staging/provision.sh plan`, requiring `CUSTOM_POLICY_SIMULATION=PASS` and `GENESIS_STAGING_PLAN_GATE=PASS`.

Missing policy state reports `ADMIN_BOOTSTRAP_REQUIRED`; document differences or unreadable state fail. The workflow contains no IAM mutation calls.

## Broad-policy transition

The five broad policies are retained only during the temporary transition state. Their removal is a separate, administrator-only action; the verify-and-plan workflow does not mutate IAM. After removal, the final verify-and-plan must pass under the five-policy scoped role before any apply. Policy `04` blocks self-modification, so GitHub Actions must never be used to remove those policies.

This division of responsibility is safer than GitHub self-modifying its role: workflow code cannot escalate its permissions, lock itself out mid-run, or rewrite the authorization constraints governing later steps. No change to the existing GitHub OIDC trust policy is part of this design.
