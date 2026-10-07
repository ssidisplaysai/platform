# Genesis staging IAM transition

## Administrator-owned IAM changes

`GenesisGitHubDeployRole` must not administer its own authorization. The role's current broad managed policies do not grant the complete permissions required to create customer-managed policies and attach them to the role. In addition, `04-production-guardrails-deny` explicitly denies role-policy mutation against `GenesisGitHubDeployRole`. GitHub Actions therefore verifies IAM state but never creates, updates, attaches, or detaches policies.

An AWS administrator must run `infra/staging/admin-bootstrap-iam.sh` manually from an authorized environment containing this repository. The helper is not invoked by GitHub Actions. It:

1. Verifies AWS account `452630323448`, reads `GenesisGitHubDeployRole`, requires zero inline policies, and confirms all five expected broad policies are attached.
2. Creates or reuses only the four `GenesisStagingDeploy-*` policies. Existing default policy versions must semantically match the corresponding repository documents; mismatches or unreadable state fail without overwrite.
3. Attaches policies `01`, `02`, and `03`, then attaches `04-production-guardrails-deny` last.
4. After policy `04` is attached, performs only read-only verification and requires exactly the five broad plus four staging policies and zero inline policies.

The helper never detaches policies, changes an existing policy or version, applies infrastructure, deploys, or modifies Cognito, DNS, load balancers/listeners, or production resources.

## GitHub verification and read-only plan

The reusable `.github/workflows/genesis-staging-bootstrap.yml` is named **Genesis Staging IAM Verify and Plan**. Despite its historical filename, it is strictly verification plus read-only planning. Through GitHub OIDC using `GenesisGitHubDeployRole`, it:

- verifies the account and role;
- requires zero inline policies;
- requires exactly the five broad policies and four staging policies;
- retrieves each staging policy's default version and compares its normalized JSON semantically with the repository file; and
- runs `bash infra/staging/provision.sh plan`, requiring `CUSTOM_POLICY_SIMULATION=PASS` and `GENESIS_STAGING_PLAN_GATE=PASS`.

Missing policy state reports `ADMIN_BOOTSTRAP_REQUIRED`; document differences or unreadable state fail. The workflow contains no IAM mutation calls.

## Broad-policy transition

The five broad policies remain attached through bootstrap and verification. Any eventual broad-policy removal is a separate, administrator-only action after review of a successful plan, simulation evidence, role-use evidence, and current inline-policy state. Policy `04` blocks self-modification, so GitHub Actions must never be used to remove those policies.

This division of responsibility is safer than GitHub self-modifying its role: workflow code cannot escalate its permissions, lock itself out mid-run, or rewrite the authorization constraints governing later steps. No change to the existing GitHub OIDC trust policy is part of this design.
