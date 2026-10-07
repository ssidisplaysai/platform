# Deploy-role least-privilege transition (PROPOSED - DO NOT EXECUTE until approved)

Current managed policies on `GenesisGitHubDeployRole` (read by the plan on 2026-10-07):

| Managed policy ARN | Needed for staging? |
|---|---|
| `arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess` | No - replaced by staging-scoped ECR in `02` |
| `arn:aws:iam::aws:policy/AmazonECS_FullAccess` | No - replaced by staging-scoped ECS in `02` |
| `arn:aws:iam::aws:policy/CloudWatchFullAccessV2` | No - replaced by staging log-group scope in `02` |
| `arn:aws:iam::aws:policy/AmazonS3FullAccess` | No - staging workflow uses no S3 |
| `arn:aws:iam::aws:policy/AmazonRDSFullAccess` | No - staging uses EFS, not RDS |

All five should be removed once the replacements are verified. Inline policies could not be listed (`iam:ListRolePolicies` was denied); list them first and review them too.

## Preconditions
1. Confirm nothing else relies on these broad permissions (other repositories' workflows, other pipelines). Check CloudTrail `AssumeRoleWithWebIdentity` events for `GenesisGitHubDeployRole` over the last 90 days. If anything else uses the role, give staging its own role instead of detaching.
2. Record the current state for rollback: `aws iam list-attached-role-policies --role-name GenesisGitHubDeployRole` and `aws iam list-role-policies --role-name GenesisGitHubDeployRole`.
3. The read-only plan now fails closed unless it reads the complete production/staging approval inputs, retrieves every deploy-role inline policy document, and passes both custom-policy and principal-policy simulations. It also checks role usage in `us-east-1` and `us-west-2`; only `ROLE_USAGE_CLEARANCE=PLATFORM_ONLY` clears the role for narrowing. `UNKNOWN` and `SHARED_ROLE` stop the gate. Plan mode invokes `infra/staging/plan-gate.mjs` before any provisioning code; that helper permits only its explicit describe/list/get/lookup/simulation AWS API allowlist.

## Steps (run by an administrator, not by the deploy role)
1. Create the four customer-managed policies (additive, no risk):
   ```
   for n in 01-read-only-production-inspection 02-staging-compute-network-auth 03-staging-data-iam 04-production-guardrails-deny; do
     aws iam create-policy --policy-name "GenesisStagingDeploy-$n" --policy-document "file://infra/staging/iam/$n.json"
   done
   ```
2. Attach them (the broad policies remain attached, so nothing can break yet):
   ```
   for n in ...; do aws iam attach-role-policy --role-name GenesisGitHubDeployRole --policy-arn arn:aws:iam::452630323448:policy/GenesisStagingDeploy-$n; done
   ```
3. Verify. The broad policies would make `simulate-principal-policy` pass trivially, so verify the new policies **in isolation**: run the read-only plan, whose custom-policy simulation uses only the four proposed policies. Every case must match its expectation (allow cases allowed, production/deny cases denied, and cases marked `requireExplicitDeny` must be explicitly denied). The plan also runs `SimulatePrincipalPolicy` for each required staging allow case; all must be allowed. Both simulations must complete with zero mismatches.
4. Only after step 3 has zero mismatches, role usage is `PLATFORM_ONLY`, and all inline policies and CloudTrail events have been reviewed, detach the broad policies, one at a time, re-running the plan after each:
   ```
   aws iam detach-role-policy --role-name GenesisGitHubDeployRole --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
   aws iam detach-role-policy --role-name GenesisGitHubDeployRole --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess
   aws iam detach-role-policy --role-name GenesisGitHubDeployRole --policy-arn arn:aws:iam::aws:policy/CloudWatchFullAccessV2
   aws iam detach-role-policy --role-name GenesisGitHubDeployRole --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess
   aws iam detach-role-policy --role-name GenesisGitHubDeployRole --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess
   ```
5. Re-run the plan with only the customer-managed policies attached. Apply is allowed only when the plan succeeds with no AccessDenied.

## Rollback
Re-attach any detached AWS managed policy with `aws iam attach-role-policy` using the same ARN. Detach the customer-managed policies only if they are the cause of a failure.

## Notes
- The deploy role cannot edit its own policies (`04` denies this); the transition must be performed by an administrator.
- Policy `04` is a defense in depth that is only needed while broad policies are attached; after the transition it still blocks production mutation if a broad policy is ever re-attached.
