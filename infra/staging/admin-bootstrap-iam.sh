#!/usr/bin/env bash
set -euo pipefail

readonly EXPECTED_ACCOUNT="452630323448"
readonly ROLE_NAME="GenesisGitHubDeployRole"
readonly POLICY_PREFIX="GenesisStagingDeploy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
source "$SCRIPT_DIR/aws-cli-file-path.sh"
POLICY_DIR="$SCRIPT_DIR/iam"
readonly POLICY_DIR
WORK_DIR="$(mktemp -d)"
readonly WORK_DIR
trap 'rm -rf "$WORK_DIR"' EXIT

readonly POLICY_NAMES=(
  "01-read-only-production-inspection"
  "02-staging-compute-network-auth"
  "03-staging-data-iam"
  "04-production-guardrails-deny"
  "05-staging-postgres-provisioning"
)

fail() {
  printf 'ADMIN_BOOTSTRAP_FAILED: %s\n' "$*" >&2
  exit 1
}

policy_arn() {
  printf 'arn:aws:iam::%s:policy/%s-%s' "$EXPECTED_ACCOUNT" "$POLICY_PREFIX" "$1"
}

compare_policy_documents() {
  local repository_file="$1"
  local actual_file="$2"
  python3 - "$repository_file" "$actual_file" <<'PY'
import json
import sys
from pathlib import Path
from urllib.parse import unquote

def load_document(path):
    value = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if isinstance(value, str):
        value = json.loads(unquote(value))
    return value

def normalize(value):
    if isinstance(value, dict):
        return {key: normalize(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        normalized = [normalize(item) for item in value]
        return sorted(
            normalized,
            key=lambda item: json.dumps(item, sort_keys=True, separators=(",", ":")),
        )
    return value

if normalize(load_document(sys.argv[1])) != normalize(load_document(sys.argv[2])):
    raise SystemExit(1)
PY
}

refresh_production_inspection_policy() {
  local policy_file="$POLICY_DIR/01-read-only-production-inspection.json"
  local arn
  arn="$(policy_arn "01-read-only-production-inspection")"
  local account_id
  account_id="$(aws sts get-caller-identity --query Account --output text)" ||
    fail "unable to verify the active AWS account"
  [[ "$account_id" == "$EXPECTED_ACCOUNT" ]] ||
    fail "expected account $EXPECTED_ACCOUNT; refusing to continue"

  aws iam get-role --role-name "$ROLE_NAME" >/dev/null ||
    fail "unable to read $ROLE_NAME"
  aws iam list-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/inline.json" ||
    fail "unable to list inline policies on $ROLE_NAME"
  jq -e '.PolicyNames | length == 0' "$WORK_DIR/inline.json" >/dev/null ||
    fail "$ROLE_NAME must have zero inline policies"

  aws iam list-attached-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/attached.json" ||
    fail "unable to list attached managed policies on $ROLE_NAME"
  jq -e --arg arn "$arn" '.AttachedPolicies | any(.PolicyArn == $arn)' "$WORK_DIR/attached.json" >/dev/null ||
    fail "the existing production inspection policy is not attached to $ROLE_NAME; refusing to attach it"

  if ! python3 - "$policy_file" <<'PY'
import json
import sys
from pathlib import Path

approved = {
    "cloudformation:DescribeStacks",
    "cloudwatch:DescribeAlarms",
    "ec2:DescribeRouteTables",
    "ecr:BatchGetImage",
    "ecr:ListImages",
    "ecs:DescribeTasks",
    "ecs:ListTaskDefinitions",
    "ecs:ListTasks",
    "logs:DescribeLogStreams",
    "rds:DescribeDBClusterSnapshots",
    "rds:DescribeDBClusters",
    "rds:DescribeDBInstances",
    "rds:DescribeDBSnapshots",
    "rds:DescribeDBSubnetGroups",
    "cloudformation:DescribeStackEvents",
    "cloudformation:ListChangeSets",
    "cloudformation:ListStackResources",
    "iam:GetPolicy",
    "secretsmanager:DescribeSecret",
}
expected_resources = {
    "cloudformation:DescribeStacks": [
        "arn:aws:cloudformation:us-west-2:452630323448:stack/GenesisRuntimeStack/*",
    ],
    "cloudwatch:DescribeAlarms": ["*"],
    "ec2:DescribeRouteTables": ["*"],
    "ecr:BatchGetImage": [
        "arn:aws:ecr:us-west-2:452630323448:repository/genesis-production-runtime",
    ],
    "ecr:ListImages": [
        "arn:aws:ecr:us-west-2:452630323448:repository/genesis-production-runtime",
    ],
    "ecs:DescribeTasks": ["*"],
    "ecs:ListTaskDefinitions": ["*"],
    "ecs:ListTasks": ["*"],
    "logs:DescribeLogStreams": [
        "arn:aws:logs:us-west-2:452630323448:log-group:/genesis/production/web:*",
    ],
    "rds:DescribeDBClusterSnapshots": ["*"],
    "rds:DescribeDBClusters": ["*"],
    "rds:DescribeDBInstances": ["*"],
    "rds:DescribeDBSnapshots": ["*"],
    "rds:DescribeDBSubnetGroups": ["*"],
    "cloudformation:DescribeStackEvents": [
        "arn:aws:cloudformation:us-west-2:452630323448:stack/GenesisRuntimeStack/*",
    ],
    "cloudformation:ListChangeSets": [
        "arn:aws:cloudformation:us-west-2:452630323448:stack/GenesisRuntimeStack/*",
    ],
    "cloudformation:ListStackResources": [
        "arn:aws:cloudformation:us-west-2:452630323448:stack/GenesisRuntimeStack/*",
    ],
    "secretsmanager:DescribeSecret": [
        "arn:aws:secretsmanager:us-west-2:452630323448:secret:GenesisFoundationStackGenes-qUJa9sj48pI1-D65uuI",
        "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/openai-*",
        "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/wordpress-*",
    ],
    "iam:GetPolicy": [
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-01-read-only-production-inspection",
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-02-staging-compute-network-auth",
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-03-staging-data-iam",
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-04-production-guardrails-deny",
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-05-staging-postgres-provisioning",
        "arn:aws:iam::452630323448:policy/GenesisRuntimeStack-*",
    ],
    "iam:GetPolicyVersion": [
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-01-read-only-production-inspection",
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-02-staging-compute-network-auth",
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-03-staging-data-iam",
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-04-production-guardrails-deny",
        "arn:aws:iam::452630323448:policy/GenesisStagingDeploy-05-staging-postgres-provisioning",
        "arn:aws:iam::452630323448:policy/GenesisRuntimeStack-*",
    ],
    "iam:SimulatePrincipalPolicy": [
        "arn:aws:iam::452630323448:role/GenesisGitHubDeployRole",
        "arn:aws:iam::452630323448:role/genesis-staging-execution-role",
    ],
}
expected_conditions = {
    "ecs:DescribeTasks": {
        "ArnEquals": {
            "ecs:cluster": "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
        },
    },
    "ecs:ListTasks": {
        "ArnEquals": {
            "ecs:cluster": "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
        },
    },
}
baseline = {
    "ecs:DescribeServices",
    "ecs:DescribeTaskDefinition",
    "cloudtrail:LookupEvents",
    "elasticloadbalancing:DescribeTargetGroups",
    "elasticloadbalancing:DescribeLoadBalancers",
    "elasticloadbalancing:DescribeListeners",
    "elasticloadbalancing:DescribeRules",
    "elasticloadbalancing:DescribeListenerCertificates",
    "elasticloadbalancing:DescribeTargetHealth",
    "ec2:DescribeSecurityGroups",
    "ec2:DescribeSubnets",
    "ec2:DescribeNetworkInterfaces",
    "sts:GetCallerIdentity",
    "cognito-idp:DescribeUserPool",
    "cognito-idp:DescribeUserPoolClient",
    "cognito-idp:ListUserPoolClients",
    "iam:GetPolicyVersion",
    "iam:GetRole",
    "iam:ListAttachedRolePolicies",
    "iam:ListRolePolicies",
    "iam:GetRolePolicy",
    "iam:SimulatePrincipalPolicy",
    "iam:SimulateCustomPolicy",
    "ecr:DescribeImages",
    "ecr:DescribeRepositories",
}
forbidden = {
    "secretsmanager:GetSecretValue",
    "iam:PassRole",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:PutRolePolicy",
    "iam:CreateRole",
    "iam:CreatePolicy",
    "iam:CreatePolicyVersion",
    "iam:DeletePolicyVersion",
    "iam:SetDefaultPolicyVersion",
    "iam:UpdateAssumeRolePolicy",
    "ecs:UpdateService",
    "ecs:RegisterTaskDefinition",
    "ecs:DeregisterTaskDefinition",
    "ecs:RunTask",
    "ecs:StopTask",
    "ecr:PutImage",
    "cloudformation:CreateStack",
    "cloudformation:CreateChangeSet",
    "cloudformation:UpdateStack",
    "cloudformation:ExecuteChangeSet",
    "cloudformation:DeleteStack",
    "cloudformation:DeleteChangeSet",
    "rds:ModifyDBInstance",
    "rds:ModifyDBCluster",
}
path = Path(sys.argv[1])
if len("".join(path.read_text(encoding="utf-8").split())) >= 6144:
    raise SystemExit("policy exceeds the customer-managed policy size limit")
document = json.loads(path.read_text(encoding="utf-8"))
actions = []
resources_by_action = {}
for statement in document.get("Statement", []):
    if statement.get("Effect") != "Allow":
        raise SystemExit("inspection policy contains a non-Allow statement")
    values = statement.get("Action", [])
    values = [values] if isinstance(values, str) else values
    resources = statement.get("Resource", [])
    resources = [resources] if isinstance(resources, str) else resources
    for action in values:
        actions.append(action)
        resources_by_action.setdefault(action, []).extend(resources)
if not approved.issubset(actions):
    raise SystemExit("one or more explicitly approved inspection actions are missing")
if set(actions) != baseline | approved or len(actions) != len(set(actions)):
    raise SystemExit("policy has an unexpected action set")
if (
    forbidden.intersection(actions)
    or any("*" in action for action in actions)
    or any(action.startswith(("rds:Modify", "rds:Create", "rds:Delete")) for action in actions)
):
    raise SystemExit("policy contains a prohibited action or wildcard action")
for action, expected in expected_resources.items():
    if sorted(resources_by_action.get(action, [])) != sorted(expected):
        raise SystemExit(f"unexpected resource scope for {action}")
statements_by_action = {}
for statement in document.get("Statement", []):
    values = statement.get("Action", [])
    values = [values] if isinstance(values, str) else values
    for action in values:
        statements_by_action.setdefault(action, []).append(statement)
for action, expected in expected_conditions.items():
    if any(statement.get("Condition") != expected for statement in statements_by_action.get(action, [])):
        raise SystemExit(f"unexpected condition for {action}")
for action in set(actions) - set(expected_conditions):
    if any("Condition" in statement for statement in statements_by_action.get(action, [])):
        raise SystemExit(f"unexpected condition for {action}")
PY
  then
    fail "the proposed inspection policy contains unapproved or mutating permissions"
  fi

  local metadata_file="$WORK_DIR/inspection-policy-metadata.json"
  local document_file="$WORK_DIR/inspection-policy-document.json"
  aws iam get-policy --policy-arn "$arn" --output json > "$metadata_file" ||
    fail "unable to read the existing inspection policy"
  local version_id
  version_id="$(jq -er '.Policy.DefaultVersionId' "$metadata_file")" ||
    fail "existing inspection policy has no readable default version"
  aws iam get-policy-version --policy-arn "$arn" --version-id "$version_id" \
    --query PolicyVersion.Document --output json > "$document_file" ||
    fail "unable to read default version $version_id of the inspection policy"
  if compare_policy_documents "$policy_file" "$document_file"; then
    printf 'POLICY_ALREADY_CURRENT=%s VERSION=%s\n' "$arn" "$version_id"
  else
    local versions_file="$WORK_DIR/inspection-policy-versions.json"
    aws iam list-policy-versions --policy-arn "$arn" --output json > "$versions_file" ||
      fail "unable to count policy versions; refusing to update"
    local version_count
    version_count="$(jq -er '.Versions | length' "$versions_file")" ||
      fail "policy-version response was invalid"
    [[ "$version_count" -lt 5 ]] ||
      fail "the policy already has five versions; refusing to delete a version or change its history"
    local new_version
    new_version="$(aws iam create-policy-version \
      --policy-arn "$arn" \
      --policy-document "$(aws_cli_file_uri "$policy_file")" \
      --set-as-default \
      --query PolicyVersion.VersionId \
      --output text)" ||
      fail "unable to create the approved inspection policy version"
    printf 'POLICY_VERSION_CREATED=%s VERSION=%s\n' "$arn" "$new_version"
  fi

  aws iam get-policy --policy-arn "$arn" --output json > "$metadata_file" ||
    fail "unable to verify the updated inspection policy"
  version_id="$(jq -er '.Policy.DefaultVersionId' "$metadata_file")" ||
    fail "updated inspection policy has no readable default version"
  aws iam get-policy-version --policy-arn "$arn" --version-id "$version_id" \
    --query PolicyVersion.Document --output json > "$document_file" ||
    fail "unable to verify default version $version_id of the inspection policy"
  compare_policy_documents "$policy_file" "$document_file" ||
    fail "the active inspection policy does not match the approved repository document"
  printf 'INSPECTION_POLICY_READ_ONLY=PASS\n'
}

refresh_staging_data_policy() {
  local policy_file="$POLICY_DIR/03-staging-data-iam.json"
  local arn
  arn="$(policy_arn "03-staging-data-iam")"
  local account_id
  account_id="$(aws sts get-caller-identity --query Account --output text)" ||
    fail "unable to verify the active AWS account"
  [[ "$account_id" == "$EXPECTED_ACCOUNT" ]] ||
    fail "expected account $EXPECTED_ACCOUNT; refusing to continue"

  aws iam get-role --role-name "$ROLE_NAME" >/dev/null ||
    fail "unable to read $ROLE_NAME"
  aws iam list-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/inline.json" ||
    fail "unable to list inline policies on $ROLE_NAME"
  jq -e '.PolicyNames | length == 0' "$WORK_DIR/inline.json" >/dev/null ||
    fail "$ROLE_NAME must have zero inline policies"

  aws iam list-attached-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/attached.json" ||
    fail "unable to list attached managed policies on $ROLE_NAME"
  jq -e --arg arn "$arn" '.AttachedPolicies | any(.PolicyArn == $arn)' "$WORK_DIR/attached.json" >/dev/null ||
    fail "the existing staging-data policy is not attached to $ROLE_NAME; refusing to attach it"

  if ! python3 - "$policy_file" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
if len("".join(path.read_text(encoding="utf-8-sig").split())) >= 6144:
    raise SystemExit("policy exceeds the customer-managed policy size limit")
document = json.loads(path.read_text(encoding="utf-8-sig"))
expected_actions = {
    "ec2:AuthorizeSecurityGroupEgress", "ec2:AuthorizeSecurityGroupIngress",
    "ec2:CreateNetworkInterface", "ec2:CreateSecurityGroup", "ec2:CreateTags",
    "ec2:DeleteNetworkInterface", "ec2:DeleteSecurityGroup",
    "ec2:DescribeAvailabilityZones", "ec2:DescribeNetworkInterfaces",
    "ec2:DescribeVpcs", "ec2:ModifyNetworkInterfaceAttribute",
    "ec2:RevokeSecurityGroupEgress", "ec2:RevokeSecurityGroupIngress",
    "elasticfilesystem:CreateAccessPoint", "elasticfilesystem:CreateFileSystem",
    "elasticfilesystem:CreateMountTarget", "elasticfilesystem:DeleteAccessPoint",
    "elasticfilesystem:DeleteMountTarget", "elasticfilesystem:DescribeAccessPoints",
    "elasticfilesystem:DescribeBackupPolicy", "elasticfilesystem:DescribeFileSystems",
    "elasticfilesystem:DescribeMountTargetSecurityGroups",
    "elasticfilesystem:DescribeMountTargets", "elasticfilesystem:PutBackupPolicy",
    "elasticfilesystem:TagResource", "iam:AttachRolePolicy", "iam:CreateRole",
    "iam:CreateServiceLinkedRole", "iam:GetRole", "iam:GetRolePolicy",
    "iam:ListAttachedRolePolicies", "iam:ListRolePolicies", "iam:PutRolePolicy",
    "iam:TagRole",
}
actions = []
for statement in document.get("Statement", []):
    if statement.get("Effect") != "Allow":
        raise SystemExit("staging-data policy contains a non-Allow statement")
    values = statement.get("Action", [])
    actions.extend([values] if isinstance(values, str) else values)
if set(actions) != expected_actions:
    raise SystemExit("staging-data policy has missing or unapproved actions")
if any("*" in action for action in actions):
    raise SystemExit("staging-data policy contains a wildcard action")
if {
    "secretsmanager:GetSecretValue", "iam:PassRole", "rds:DeleteDBInstance",
    "rds:ModifyDBInstance", "rds:DeleteDBSubnetGroup", "rds:ModifyDBSubnetGroup",
}.intersection(actions):
    raise SystemExit("staging-data policy contains a prohibited action")

expected = {
    "EfsServiceLinkedRole": {
        "Action": ["iam:CreateServiceLinkedRole"],
        "Resource": "arn:aws:iam::452630323448:role/aws-service-role/elasticfilesystem.amazonaws.com/*",
        "Condition": {"StringEquals": {"iam:AWSServiceName": "elasticfilesystem.amazonaws.com"}},
    },
}
by_sid = {statement.get("Sid"): statement for statement in document.get("Statement", [])}
for sid, expected_statement in expected.items():
    statement = by_sid.get(sid)
    if not statement or statement.get("Effect") != "Allow":
        raise SystemExit(f"missing approved staging PostgreSQL statement: {sid}")
    for key, value in expected_statement.items():
        if statement.get(key) != value:
            raise SystemExit(f"unexpected {key} scope in {sid}")
expected_action_sids = {
    "iam:CreateServiceLinkedRole": {"EfsServiceLinkedRole"},
}
for action, expected_sids in expected_action_sids.items():
    actual_sids = {
        statement.get("Sid")
        for statement in document.get("Statement", [])
        if action in ([statement["Action"]] if isinstance(statement.get("Action"), str) else statement.get("Action", []))
    }
    if actual_sids != expected_sids:
        raise SystemExit(f"unexpected statement/resource scope for {action}")
PY
  then
    fail "the proposed staging-data policy contains unapproved or unsafe permissions"
  fi

  local metadata_file="$WORK_DIR/staging-data-policy-metadata.json"
  local document_file="$WORK_DIR/staging-data-policy-document.json"
  aws iam get-policy --policy-arn "$arn" --output json > "$metadata_file" ||
    fail "unable to read the existing staging-data policy"
  local version_id
  version_id="$(jq -er '.Policy.DefaultVersionId' "$metadata_file")" ||
    fail "existing staging-data policy has no readable default version"
  aws iam get-policy-version --policy-arn "$arn" --version-id "$version_id" \
    --query PolicyVersion.Document --output json > "$document_file" ||
    fail "unable to read default version $version_id of the staging-data policy"
  if compare_policy_documents "$policy_file" "$document_file"; then
    printf 'POLICY_ALREADY_CURRENT=%s VERSION=%s\n' "$arn" "$version_id"
  else
    local versions_file="$WORK_DIR/staging-data-policy-versions.json"
    aws iam list-policy-versions --policy-arn "$arn" --output json > "$versions_file" ||
      fail "unable to count staging-data policy versions; refusing to update"
    local version_count
    version_count="$(jq -er '.Versions | length' "$versions_file")" ||
      fail "staging-data policy-version response was invalid"
    [[ "$version_count" -lt 5 ]] ||
      fail "the staging-data policy already has five versions; refusing to delete a version or change its history"
    local new_version
    new_version="$(aws iam create-policy-version \
      --policy-arn "$arn" \
      --policy-document "$(aws_cli_file_uri "$policy_file")" \
      --set-as-default \
      --query PolicyVersion.VersionId \
      --output text)" ||
      fail "unable to create the approved staging-data policy version"
    printf 'POLICY_VERSION_CREATED=%s VERSION=%s\n' "$arn" "$new_version"
  fi

  aws iam get-policy --policy-arn "$arn" --output json > "$metadata_file" ||
    fail "unable to verify the updated staging-data policy"
  version_id="$(jq -er '.Policy.DefaultVersionId' "$metadata_file")" ||
    fail "updated staging-data policy has no readable default version"
  aws iam get-policy-version --policy-arn "$arn" --version-id "$version_id" \
    --query PolicyVersion.Document --output json > "$document_file" ||
    fail "unable to verify default version $version_id of the staging-data policy"
  compare_policy_documents "$policy_file" "$document_file" ||
    fail "the active staging-data policy does not match the approved repository document"
  printf 'STAGING_DATA_POLICY=PASS\n'
}

refresh_staging_postgres_policy() {
  local policy_file="$POLICY_DIR/05-staging-postgres-provisioning.json"
  local arn
  arn="$(policy_arn "05-staging-postgres-provisioning")"
  local account_id
  account_id="$(aws sts get-caller-identity --query Account --output text)" ||
    fail "unable to verify the active AWS account"
  [[ "$account_id" == "$EXPECTED_ACCOUNT" ]] ||
    fail "expected account $EXPECTED_ACCOUNT; refusing to continue"

  aws iam get-role --role-name "$ROLE_NAME" >/dev/null ||
    fail "unable to read $ROLE_NAME"
  aws iam list-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/inline.json" ||
    fail "unable to list inline policies on $ROLE_NAME"
  jq -e '.PolicyNames | length == 0' "$WORK_DIR/inline.json" >/dev/null ||
    fail "$ROLE_NAME must have zero inline policies"
  aws iam list-attached-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/attached.json" ||
    fail "unable to list attached managed policies on $ROLE_NAME"
  jq -e --arg arn "$arn" '.AttachedPolicies | any(.PolicyArn == $arn)' "$WORK_DIR/attached.json" >/dev/null ||
    fail "the existing staging PostgreSQL policy is not attached to $ROLE_NAME; refusing to attach it"

  if ! node "$SCRIPT_DIR/iam/validate-staging-postgres-policy.mjs" "$policy_file"
  then
    fail "the proposed staging PostgreSQL policy contains unapproved or unsafe permissions"
  fi

  local metadata_file="$WORK_DIR/staging-postgres-policy-metadata.json"
  local document_file="$WORK_DIR/staging-postgres-policy-document.json"
  aws iam get-policy --policy-arn "$arn" --output json > "$metadata_file" ||
    fail "unable to read the existing staging PostgreSQL policy"
  local version_id
  version_id="$(jq -er '.Policy.DefaultVersionId' "$metadata_file")" ||
    fail "existing staging PostgreSQL policy has no readable default version"
  aws iam get-policy-version --policy-arn "$arn" --version-id "$version_id" \
    --query PolicyVersion.Document --output json > "$document_file" ||
    fail "unable to read default version $version_id of the staging PostgreSQL policy"
  if compare_policy_documents "$policy_file" "$document_file"; then
    printf 'POLICY_ALREADY_CURRENT=%s VERSION=%s\n' "$arn" "$version_id"
  else
    local versions_file="$WORK_DIR/staging-postgres-policy-versions.json"
    aws iam list-policy-versions --policy-arn "$arn" --output json > "$versions_file" ||
      fail "unable to count staging PostgreSQL policy versions; refusing to update"
    local version_count
    version_count="$(jq -er '.Versions | length' "$versions_file")" ||
      fail "staging PostgreSQL policy-version response was invalid"
    [[ "$version_count" -lt 5 ]] ||
      fail "the staging PostgreSQL policy already has five versions; refusing to delete a version or change its history"
    local new_version
    new_version="$(aws iam create-policy-version \
      --policy-arn "$arn" \
      --policy-document "$(aws_cli_file_uri "$policy_file")" \
      --set-as-default \
      --query PolicyVersion.VersionId \
      --output text)" ||
      fail "unable to create the approved staging PostgreSQL policy version"
    printf 'POLICY_VERSION_CREATED=%s VERSION=%s\n' "$arn" "$new_version"
  fi

  aws iam get-policy --policy-arn "$arn" --output json > "$metadata_file" ||
    fail "unable to verify the updated staging PostgreSQL policy"
  version_id="$(jq -er '.Policy.DefaultVersionId' "$metadata_file")" ||
    fail "updated staging PostgreSQL policy has no readable default version"
  aws iam get-policy-version --policy-arn "$arn" --version-id "$version_id" \
    --query PolicyVersion.Document --output json > "$document_file" ||
    fail "unable to verify default version $version_id of the staging PostgreSQL policy"
  compare_policy_documents "$policy_file" "$document_file" ||
    fail "the active staging PostgreSQL policy does not match the approved repository document"
  printf 'STAGING_POSTGRES_POLICY=PASS\n'
}

refresh_staging_postgres_certification_permissions() {
  local deploy_policy_file="$POLICY_DIR/02-staging-compute-network-auth.json"
  local secret_policy_file="$POLICY_DIR/postgres-certification-execution-secrets.json"
  local policy_arn_value
  policy_arn_value="$(policy_arn "02-staging-compute-network-auth")"
  local inline_policy_name="staging-postgres-certification-secret-read"
  local account_id
  account_id="$(aws sts get-caller-identity --query Account --output text)" ||
    fail "unable to verify the active AWS account"
  [[ "$account_id" == "$EXPECTED_ACCOUNT" ]] ||
    fail "expected account $EXPECTED_ACCOUNT; refusing to continue"

  node "$POLICY_DIR/validate-postgres-certification-execution-policy.mjs" "$secret_policy_file" ||
    fail "the proposed certification execution-role secret policy is unsafe"
  python3 - "$deploy_policy_file" <<'PY' || fail "the proposed ECS RunTask permission is unsafe"
import json
import sys
from pathlib import Path

document = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
expected = {
    "Sid": "EcsRunStagingPostgresCertificationTask",
    "Effect": "Allow",
    "Action": "ecs:RunTask",
    "Resource": "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-postgres-certification:*",
    "Condition": {"ArnEquals": {
        "ecs:cluster": "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
    }},
}
matches = [statement for statement in document.get("Statement", []) if statement.get("Sid") == expected["Sid"]]
if len(matches) != 1 or matches[0] != expected:
    raise SystemExit("RunTask statement does not match the exact approved family and cluster")
PY

  aws iam get-role --role-name "$ROLE_NAME" >/dev/null ||
    fail "unable to read $ROLE_NAME"
  aws iam list-attached-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/deploy-attached.json" ||
    fail "unable to list managed policies on $ROLE_NAME"
  jq -e --arg arn "$policy_arn_value" '.AttachedPolicies | any(.PolicyArn == $arn)' \
    "$WORK_DIR/deploy-attached.json" >/dev/null ||
    fail "the staging compute policy is not attached to $ROLE_NAME; refusing to attach it"

  local execution_role_arn
  execution_role_arn="$(aws iam get-role --role-name genesis-staging-execution-role --query Role.Arn --output text)" ||
    fail "unable to read the staging certification execution role"
  [[ "$execution_role_arn" == "arn:aws:iam::${EXPECTED_ACCOUNT}:role/genesis-staging-execution-role" ]] ||
    fail "staging certification execution role ARN did not match the approved role"
  aws iam list-role-policies --role-name genesis-staging-execution-role --output json > "$WORK_DIR/execution-role-inline.json" ||
    fail "unable to list inline policies on the staging certification execution role"
  local has_secret_policy
  has_secret_policy="$(jq -r --arg name "$inline_policy_name" \
    '.PolicyNames | any(. == $name)' "$WORK_DIR/execution-role-inline.json")" ||
    fail "inline-policy inventory for the staging certification execution role is invalid"
  if [[ "$has_secret_policy" == "true" ]]; then
    aws iam get-role-policy \
      --role-name genesis-staging-execution-role \
      --policy-name "$inline_policy_name" \
      --query PolicyDocument \
      --output json > "$WORK_DIR/execution-role-secret-policy.json" ||
      fail "unable to read the existing certification secret policy"
    compare_policy_documents "$secret_policy_file" "$WORK_DIR/execution-role-secret-policy.json" ||
      fail "the existing certification secret policy differs; refusing to overwrite it"
  fi

  local managed_metadata="$WORK_DIR/staging-compute-policy-metadata.json"
  local managed_document="$WORK_DIR/staging-compute-policy-document.json"
  aws iam get-policy --policy-arn "$policy_arn_value" --output json > "$managed_metadata" ||
    fail "unable to read the existing staging compute policy"
  local version_id
  version_id="$(jq -er '.Policy.DefaultVersionId' "$managed_metadata")" ||
    fail "staging compute policy has no readable default version"
  aws iam get-policy-version --policy-arn "$policy_arn_value" --version-id "$version_id" \
    --query PolicyVersion.Document --output json > "$managed_document" ||
    fail "unable to read the current staging compute policy document"

  if ! compare_policy_documents "$deploy_policy_file" "$managed_document"; then
    local versions_file="$WORK_DIR/staging-compute-policy-versions.json"
    aws iam list-policy-versions --policy-arn "$policy_arn_value" --output json > "$versions_file" ||
      fail "unable to count staging compute policy versions; refusing to update"
    local version_count
    version_count="$(jq -er '.Versions | length' "$versions_file")" ||
      fail "staging compute policy-version response was invalid"
    [[ "$version_count" -lt 5 ]] ||
      fail "the staging compute policy already has five versions; refusing to delete a version or change its history"
    aws iam create-policy-version \
      --policy-arn "$policy_arn_value" \
      --policy-document "$(aws_cli_file_uri "$deploy_policy_file")" \
      --set-as-default >/dev/null ||
      fail "unable to create the approved staging compute policy version"
    printf 'STAGING_COMPUTE_POLICY_UPDATED=%s\n' "$policy_arn_value"
  fi

  if [[ "$has_secret_policy" != "true" ]]; then
    aws iam put-role-policy \
      --role-name genesis-staging-execution-role \
      --policy-name "$inline_policy_name" \
      --policy-document "$(aws_cli_file_uri "$secret_policy_file")" >/dev/null ||
      fail "unable to add the approved exact-secret policy to the staging certification execution role"
    printf 'STAGING_CERTIFICATION_SECRET_POLICY_ADDED=%s\n' "$inline_policy_name"
  fi

  aws iam get-policy --policy-arn "$policy_arn_value" --output json > "$managed_metadata" ||
    fail "unable to verify the updated staging compute policy"
  version_id="$(jq -er '.Policy.DefaultVersionId' "$managed_metadata")" ||
    fail "updated staging compute policy has no readable default version"
  aws iam get-policy-version --policy-arn "$policy_arn_value" --version-id "$version_id" \
    --query PolicyVersion.Document --output json > "$managed_document" ||
    fail "unable to verify the updated staging compute policy document"
  compare_policy_documents "$deploy_policy_file" "$managed_document" ||
    fail "active staging compute policy does not match the approved repository document"

  aws iam get-role-policy \
    --role-name genesis-staging-execution-role \
    --policy-name "$inline_policy_name" \
    --query PolicyDocument \
    --output json > "$WORK_DIR/execution-role-secret-policy.json" ||
    fail "unable to verify the exact-secret execution-role policy"
  compare_policy_documents "$secret_policy_file" "$WORK_DIR/execution-role-secret-policy.json" ||
    fail "active execution-role secret policy does not match the approved exact-secret document"
  printf 'STAGING_POSTGRES_CERTIFICATION_IAM=PASS\n'
}

if [[ "${1:-}" == "--refresh-production-inspection-policy" ]]; then
  [[ "$#" == "1" ]] || fail "the inspection-policy refresh mode does not accept extra arguments"
  refresh_production_inspection_policy
  exit 0
elif [[ "${1:-}" == "--refresh-staging-data-policy" ]]; then
  [[ "$#" == "1" ]] || fail "the staging-data-policy refresh mode does not accept extra arguments"
  refresh_staging_data_policy
  exit 0
elif [[ "${1:-}" == "--refresh-staging-postgres-policy" ]]; then
  [[ "$#" == "1" ]] || fail "the staging PostgreSQL-policy refresh mode does not accept extra arguments"
  refresh_staging_postgres_policy
  exit 0
elif [[ "${1:-}" == "--refresh-staging-postgres-certification-permissions" ]]; then
  [[ "$#" == "1" ]] || fail "the staging PostgreSQL certification refresh mode does not accept extra arguments"
  refresh_staging_postgres_certification_permissions
  exit 0
elif [[ "${1:-}" == "--refresh-production-guardrails-policy" ]]; then
  [[ "$#" == "1" ]] || fail "the production guardrails-policy refresh mode does not accept extra arguments"
  policy_file="$POLICY_DIR/04-production-guardrails-deny.json"
  node "$POLICY_DIR/refresh-production-guardrails-policy.mjs" \
    "$policy_file" "$(aws_cli_file_uri "$policy_file")"
  exit $?
elif [[ "$#" != "0" ]]; then
  fail "unexpected arguments; use only an explicitly supported managed-policy refresh mode"
fi

account_id="$(aws sts get-caller-identity --query Account --output text)" ||
  fail "unable to verify the active AWS account"
printf 'AWS_ACCOUNT=%s\n' "$account_id"
[[ "$account_id" == "$EXPECTED_ACCOUNT" ]] ||
  fail "expected account $EXPECTED_ACCOUNT; refusing to continue"

aws iam get-role --role-name "$ROLE_NAME" >/dev/null ||
  fail "unable to read $ROLE_NAME"

aws iam list-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/inline.json" ||
  fail "unable to list inline policies on $ROLE_NAME"
inline_count="$(jq -er '.PolicyNames | length' "$WORK_DIR/inline.json")" ||
  fail "inline-policy response was invalid"
[[ "$inline_count" == "0" ]] ||
  fail "$ROLE_NAME must have zero inline policies; found $inline_count"
printf 'IAM_INLINE_POLICY_COUNT=%s\n' "$inline_count"

aws iam list-attached-role-policies \
  --role-name "$ROLE_NAME" \
  --output json > "$WORK_DIR/attached-before.json" ||
  fail "unable to list attached managed policies on $ROLE_NAME"

bash "$POLICY_DIR/validate-scoped-role-policies.sh" "$WORK_DIR/attached-before.json" ||
  fail "role policy state is not the approved scoped-only 01-04 or 01-05 set"

for index in "${!POLICY_NAMES[@]}"; do
  name="${POLICY_NAMES[$index]}"
  policy_file="$POLICY_DIR/$name.json"
  [[ -f "$policy_file" ]] || fail "repository policy file is missing: $policy_file"
  jq -e ' .Version == "2012-10-17" and (.Statement | type == "array") ' \
    "$policy_file" >/dev/null ||
    fail "repository policy JSON is invalid: $policy_file"
  python3 - "$policy_file" <<'PY' ||
import sys
from pathlib import Path
if len("".join(Path(sys.argv[1]).read_text(encoding="utf-8-sig").split())) >= 6144:
    raise SystemExit("policy exceeds the customer-managed policy size limit")
PY
    fail "repository policy exceeds the AWS managed-policy size limit: $policy_file"

  arn="$(policy_arn "$name")"
  metadata_file="$WORK_DIR/$name-metadata.json"
  error_file="$WORK_DIR/$name-error.txt"

  if aws iam get-policy --policy-arn "$arn" --output json > "$metadata_file" 2> "$error_file"; then
    version_id="$(jq -er '.Policy.DefaultVersionId' "$metadata_file")" ||
      fail "existing policy $arn has no readable default version"
    document_file="$WORK_DIR/$name-document.json"
    aws iam get-policy-version \
      --policy-arn "$arn" \
      --version-id "$version_id" \
      --query PolicyVersion.Document \
      --output json > "$document_file" ||
      fail "unable to read default version $version_id of $arn"
    compare_policy_documents "$policy_file" "$document_file" ||
      fail "existing policy $arn differs from $policy_file; refusing to overwrite"
    printf 'POLICY_REUSED=%s ARN=%s VERSION=%s\n' "$name" "$arn" "$version_id"
  else
    if ! grep -q 'NoSuchEntity' "$error_file"; then
      cat "$error_file" >&2
      fail "unable to determine whether $arn exists; refusing to create it"
    fi
    created_arn="$(aws iam create-policy \
      --policy-name "$POLICY_PREFIX-$name" \
      --policy-document "$(aws_cli_file_uri "$policy_file")" \
      --query Policy.Arn \
      --output text)" ||
      fail "unable to create $arn"
    [[ "$created_arn" == "$arn" ]] ||
      fail "AWS returned unexpected policy ARN: $created_arn"
    printf 'POLICY_CREATED=%s ARN=%s\n' "$name" "$arn"
  fi
done

for name in "${POLICY_NAMES[@]}"; do
  arn="$(policy_arn "$name")"
  policy_file="$POLICY_DIR/$name.json"
  metadata_file="$WORK_DIR/$name-verified-metadata.json"
  document_file="$WORK_DIR/$name-verified-document.json"
  aws iam get-policy --policy-arn "$arn" --output json > "$metadata_file" ||
    fail "unable to verify policy metadata for $arn"
  version_id="$(jq -er '.Policy.DefaultVersionId' "$metadata_file")" ||
    fail "default policy version is missing for $arn"
  aws iam get-policy-version \
    --policy-arn "$arn" \
    --version-id "$version_id" \
    --query PolicyVersion.Document \
    --output json > "$document_file" ||
    fail "unable to verify default policy document for $arn"
  compare_policy_documents "$policy_file" "$document_file" ||
    fail "policy document verification failed for $arn"
done

arn="$(policy_arn "05-staging-postgres-provisioning")"
if ! jq -e --arg arn "$arn" '.AttachedPolicies | any(.PolicyArn == $arn)' \
  "$WORK_DIR/attached-before.json" >/dev/null; then
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$arn" ||
    fail "unable to attach policy 05 under the existing policy 04 guardrail: $arn"
  printf 'POLICY_ATTACHED=%s\n' "$arn"
else
  printf 'POLICY_ALREADY_ATTACHED=%s\n' "$arn"
fi

aws iam list-attached-role-policies \
  --role-name "$ROLE_NAME" \
  --output json > "$WORK_DIR/attached-after.json" ||
  fail "unable to verify attached managed policies after bootstrap"

bash "$POLICY_DIR/validate-scoped-role-policies.sh" "$WORK_DIR/attached-after.json" ||
  fail "final role state must contain exactly scoped Genesis policies 01-05 and no broad policies"

aws iam list-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/inline-after.json" ||
  fail "unable to verify inline policies after bootstrap"
jq -e '.PolicyNames | length == 0' "$WORK_DIR/inline-after.json" >/dev/null ||
  fail "inline policies were found after bootstrap"

printf 'ATTACHED_MANAGED_POLICY_COUNT=5\n'
printf 'IAM_INLINE_POLICY_COUNT=0\n'
printf 'ADMIN_BOOTSTRAP=PASS\n'
