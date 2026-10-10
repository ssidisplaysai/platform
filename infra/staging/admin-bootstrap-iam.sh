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

readonly BROAD_POLICY_ARNS=(
  "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
  "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
  "arn:aws:iam::aws:policy/AmazonECS_FullAccess"
  "arn:aws:iam::aws:policy/AmazonS3FullAccess"
  "arn:aws:iam::aws:policy/CloudWatchFullAccessV2"
)
readonly POLICY_NAMES=(
  "01-read-only-production-inspection"
  "02-staging-compute-network-auth"
  "03-staging-data-iam"
  "04-production-guardrails-deny"
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
    "ecs:DescribeTasks": [
        "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
        "arn:aws:ecs:us-west-2:452630323448:task/genesis-production/*",
    ],
    "ecs:ListTaskDefinitions": ["*"],
    "ecs:ListTasks": [
        "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
    ],
    "logs:DescribeLogStreams": [
        "arn:aws:logs:us-west-2:452630323448:log-group:/genesis/production/web:*",
    ],
    "rds:DescribeDBClusterSnapshots": ["*"],
    "rds:DescribeDBClusters": ["*"],
    "rds:DescribeDBInstances": ["*"],
    "rds:DescribeDBSnapshots": ["*"],
    "rds:DescribeDBSubnetGroups": ["*"],
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
    "iam:GetPolicy",
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
    "ecs:UpdateService",
    "ecs:RegisterTaskDefinition",
    "ecs:DeregisterTaskDefinition",
    "ecr:PutImage",
    "cloudformation:CreateStack",
    "cloudformation:UpdateStack",
    "cloudformation:ExecuteChangeSet",
    "rds:ModifyDBInstance",
    "rds:ModifyDBCluster",
}
path = Path(sys.argv[1])
if path.stat().st_size >= 6144:
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
if forbidden.intersection(actions) or any("*" in action for action in actions):
    raise SystemExit("policy contains a prohibited action or wildcard action")
for action, expected in expected_resources.items():
    if sorted(resources_by_action.get(action, [])) != sorted(expected):
        raise SystemExit(f"unexpected resource scope for {action}")
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

if [[ "${1:-}" == "--refresh-production-inspection-policy" ]]; then
  [[ "$#" == "1" ]] || fail "the inspection-policy refresh mode does not accept extra arguments"
  refresh_production_inspection_policy
  exit 0
elif [[ "$#" != "0" ]]; then
  fail "unexpected arguments; use --refresh-production-inspection-policy only for the approved read-only inspection policy"
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

jq -e --argjson broad "$(printf '%s\n' "${BROAD_POLICY_ARNS[@]}" | jq -R . | jq -s .)" \
  --argjson staging "$(printf '%s\n' "${POLICY_NAMES[@]}" | while IFS= read -r name; do policy_arn "$name"; done | jq -R . | jq -s .)" '
  [.AttachedPolicies[].PolicyArn] as $attached
  | ($broad - $attached) as $missing_broad
  | ($staging - $attached) as $missing_staging
  | ($attached - ($broad + $staging)) as $unexpected
  | if ($missing_broad | length) == 0 and ($unexpected | length) == 0
    then true
    else error("unexpected role policy state; missing broad policies: \($missing_broad|join(", ")); unexpected policies: \($unexpected|join(", "))")
    end
' "$WORK_DIR/attached-before.json" >/dev/null ||
  fail "role policy state differs from the approved broad-plus-staging policy set"

policy04_arn="$(policy_arn "${POLICY_NAMES[3]}")"
policy04_attached="$(jq -r --arg arn "$policy04_arn" '[.AttachedPolicies[].PolicyArn | select(. == $arn)] | length' "$WORK_DIR/attached-before.json")"
if [[ "$policy04_attached" == "1" ]]; then
  for name in "${POLICY_NAMES[@]:0:3}"; do
    arn="$(policy_arn "$name")"
    jq -e --arg arn "$arn" '.AttachedPolicies | any(.PolicyArn == $arn)' \
      "$WORK_DIR/attached-before.json" >/dev/null ||
      fail "policy 04 is already attached while $name is missing; refusing all further changes"
  done
fi

for index in "${!POLICY_NAMES[@]}"; do
  name="${POLICY_NAMES[$index]}"
  policy_file="$POLICY_DIR/$name.json"
  [[ -f "$policy_file" ]] || fail "repository policy file is missing: $policy_file"
  jq -e ' .Version == "2012-10-17" and (.Statement | type == "array") ' \
    "$policy_file" >/dev/null ||
    fail "repository policy JSON is invalid: $policy_file"

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
    if [[ "$policy04_attached" == "1" ]]; then
      fail "policy 04 is already attached; refusing any subsequent IAM mutation because only read-only verification is permitted"
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

for name in "${POLICY_NAMES[@]:0:3}"; do
  arn="$(policy_arn "$name")"
  if ! jq -e --arg arn "$arn" '.AttachedPolicies | any(.PolicyArn == $arn)' \
    "$WORK_DIR/attached-before.json" >/dev/null; then
    aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$arn" ||
      fail "unable to attach $arn"
    printf 'POLICY_ATTACHED=%s\n' "$arn"
  else
    printf 'POLICY_ALREADY_ATTACHED=%s\n' "$arn"
  fi
done

if [[ "$policy04_attached" != "1" ]]; then
  arn="$policy04_arn"
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$arn" ||
    fail "unable to attach final guardrail policy $arn"
  printf 'POLICY_ATTACHED_LAST=%s\n' "$arn"
else
  printf 'POLICY_ALREADY_ATTACHED_LAST=%s\n' "$policy04_arn"
fi

# Policy 04 is the last possible mutation; only read-only verification follows.
aws iam list-attached-role-policies \
  --role-name "$ROLE_NAME" \
  --output json > "$WORK_DIR/attached-after.json" ||
  fail "unable to verify attached managed policies after bootstrap"

expected_arns=("${BROAD_POLICY_ARNS[@]}")
for name in "${POLICY_NAMES[@]}"; do
  expected_arns+=("$(policy_arn "$name")")
done
expected_json="$(printf '%s\n' "${expected_arns[@]}" | jq -R . | jq -s .)"
jq -e --argjson expected "$expected_json" '
  [.AttachedPolicies[].PolicyArn] as $attached
  | (($attached | sort) == ($expected | sort))
    and (($attached | length) == 9)
' "$WORK_DIR/attached-after.json" >/dev/null ||
  fail "final attached-policy set is not exactly the five broad plus four staging policies"

aws iam list-role-policies --role-name "$ROLE_NAME" --output json > "$WORK_DIR/inline-after.json" ||
  fail "unable to verify inline policies after bootstrap"
jq -e '.PolicyNames | length == 0' "$WORK_DIR/inline-after.json" >/dev/null ||
  fail "inline policies were found after bootstrap"

printf 'ATTACHED_MANAGED_POLICY_COUNT=9\n'
printf 'IAM_INLINE_POLICY_COUNT=0\n'
printf 'ADMIN_BOOTSTRAP=PASS\n'
