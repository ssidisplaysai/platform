# Genesis staging IAM transition

## Administrator-owned IAM changes

`GenesisGitHubDeployRole` must not administer its own authorization. The role's current broad managed policies do not grant the complete permissions required to create customer-managed policies and attach them to the role. In addition, `04-production-guardrails-deny` explicitly denies role-policy mutation against `GenesisGitHubDeployRole`. GitHub Actions therefore verifies IAM state but never creates, updates, attaches, or detaches policies.

An AWS administrator must run `infra/staging/admin-bootstrap-iam.sh` manually from an authorized environment containing this repository. The helper is not invoked by GitHub Actions. It:

1. Verifies AWS account `452630323448`, reads `GenesisGitHubDeployRole`, requires zero inline policies, and confirms all five expected broad policies are attached.
2. Creates or reuses only the four `GenesisStagingDeploy-*` policies. Existing default policy versions must semantically match the corresponding repository documents; mismatches or unreadable state fail without overwrite.
3. Attaches policies `01`, `02`, and `03`, then attaches `04-production-guardrails-deny` last.
4. After policy `04` is attached, performs only read-only verification of the temporary transition state: exactly the five broad plus four staging policies and zero inline policies.

The helper never detaches policies, changes an existing policy or version, applies infrastructure, deploys, or modifies Cognito, DNS, load balancers/listeners, or production resources.

For an explicitly approved change to the already-attached production inspection policy only, an AWS administrator can run:

```sh
bash infra/staging/admin-bootstrap-iam.sh --refresh-production-inspection-policy
```

This restricted mode verifies the AWS account, the existing role and attached policy, zero inline role policies, and the proposed read-only document. It creates a new default version only for `GenesisStagingDeploy-01-read-only-production-inspection`; it never attaches/detaches policies or modifies another role or policy. It refuses to delete old policy versions if IAM's five-version limit has been reached. The GitHub OIDC role must not run this mode; policy 04 explicitly blocks self-administration. The no-argument bootstrap behavior remains unchanged.

The production inspection policy adds only these approved reads: `cloudformation:DescribeStacks`, `cloudwatch:DescribeAlarms`, `ec2:DescribeRouteTables`, `ecr:BatchGetImage`, `ecr:ListImages`, `ecs:DescribeTasks`, `ecs:ListTaskDefinitions`, `ecs:ListTasks`, `logs:DescribeLogStreams`, `rds:DescribeDBClusterSnapshots`, `rds:DescribeDBClusters`, `rds:DescribeDBInstances`, `rds:DescribeDBSnapshots`, and `rds:DescribeDBSubnetGroups`. Resource scopes are limited to `GenesisRuntimeStack`, the production ECR repository, ECS cluster/tasks, and the production web log streams. AWS requires `Resource: "*"` for each of the five RDS Describe APIs because they do not support resource-level permissions. `Resource: "*"` is also used for `ecs:ListTaskDefinitions` (no resource-level support), `ec2:DescribeRouteTables` (no resource-level support), and `cloudwatch:DescribeAlarms` (the inspection enumerates metric and composite alarms; composite alarm discovery requires wildcard scope). The inspection query specifies `GenesisRuntimeStack` by name and describes log streams only for `/genesis/production/web` so those requests conform to the policy scopes.

The nine-policy state is temporary. The final role state contains only the four scoped `GenesisStagingDeploy-*` policies; all five broad AWS-managed policies must be absent.

## GitHub verification and read-only plan

The reusable `.github/workflows/genesis-staging-bootstrap.yml` is named **Genesis Staging IAM Verify and Plan**. Despite its historical filename, it is strictly verification plus read-only planning. Through GitHub OIDC using `GenesisGitHubDeployRole`, it:

- verifies the account and role;
- requires zero inline policies;
- requires exactly the four scoped staging policies and rejects the five broad AWS-managed policies and any other managed policy;
- retrieves each staging policy's default version and compares its normalized JSON semantically with the repository file; and
- runs `bash infra/staging/provision.sh plan`, requiring `CUSTOM_POLICY_SIMULATION=PASS` and `GENESIS_STAGING_PLAN_GATE=PASS`.

Missing policy state reports `ADMIN_BOOTSTRAP_REQUIRED`; document differences or unreadable state fail. The workflow contains no IAM mutation calls.

## Broad-policy transition

The five broad policies are retained only during the temporary transition state. Their removal is a separate, administrator-only action; the verify-and-plan workflow does not mutate IAM. After removal, the final verify-and-plan must pass under the four-policy scoped role before any apply. Policy `04` blocks self-modification, so GitHub Actions must never be used to remove those policies.

This division of responsibility is safer than GitHub self-modifying its role: workflow code cannot escalate its permissions, lock itself out mid-run, or rewrite the authorization constraints governing later steps. No change to the existing GitHub OIDC trust policy is part of this design.
