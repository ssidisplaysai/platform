#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-plan}"
case "$MODE" in
  plan|apply) ;;
  *) echo "Usage: postgres-provision.sh <plan|apply>" >&2; exit 2 ;;
esac

readonly ACCOUNT_ID="452630323448"
readonly REGION="${AWS_REGION:-us-west-2}"
readonly VPC_ID="vpc-05035503df7e142d6"
readonly TASK_SG_ID="sg-0687242229bc3a80e"
readonly TASK_SG_NAME="genesis-staging-web-sg"
readonly DB_IDENTIFIER="genesis-staging-postgres"
readonly DB_SUBNET_GROUP="genesis-staging-postgres"
readonly DB_ARN="arn:aws:rds:us-west-2:452630323448:db:genesis-staging-postgres"
readonly DB_SUBNET_GROUP_ARN="arn:aws:rds:us-west-2:452630323448:subgrp:genesis-staging-postgres"
readonly DB_SECURITY_GROUP_NAME="genesis-staging-postgres"
readonly APP_SECRET_NAME="genesis/staging/postgres"
readonly APP_SECRET_DESCRIPTION="Genesis staging Share-to-Grow PostgreSQL application credentials"
readonly DATABASE_NAME="genesis_staging"
readonly DB_USERNAME="genesis_app"
readonly PRIVATE_SUBNET_A="subnet-06cd58ffc45d36758"
readonly PRIVATE_SUBNET_B="subnet-0f085d9270cd1bfe6"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/aws-cli-file-path.sh"

export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"

aws_call() {
  if [ "$MODE" = "plan" ]; then
    case "$1:$2" in
      *:describe-*|*:list-*|*:get-*|sts:get-caller-identity) ;;
      *) echo "Refusing non-read-only AWS operation in postgres plan mode: $1 $2" >&2; return 1 ;;
    esac
  fi
  command aws "$@"
}

aws_optional() {
  local output
  if output="$(aws_call "$@" 2>&1)"; then
    printf '%s\n' "$output"
    return 0
  fi
  case "$output" in
    *DBSubnetGroupNotFoundFault*|*DBInstanceNotFound*|*ResourceNotFoundException*|*NoSuchEntity*)
      return 0
      ;;
    *)
      printf '%s\n' "$output" >&2
      return 1
      ;;
  esac
}

fail() {
  printf 'STAGING_POSTGRES_PREFLIGHT=FAIL reason=%s\n' "$*" >&2
  exit 1
}

[ "$REGION" = "us-west-2" ] || fail "the approved staging database resources are restricted to us-west-2"

if [ "$MODE" = "apply" ] && [ "${CONFIRM:-}" != "APPLY-STAGING-POSTGRES" ]; then
  fail "apply requires CONFIRM=APPLY-STAGING-POSTGRES"
fi

if ! plan_gate_output="$(node "$SCRIPT_DIR/plan-gate.mjs" 2>&1)"; then
  printf '%s\n' "$plan_gate_output" >&2
  fail "existing controlled staging plan gate did not pass"
fi
printf '%s\n' "$plan_gate_output"
grep -Fxq "GENESIS_STAGING_PLAN_GATE=PASS" <<< "$plan_gate_output" ||
  fail "existing controlled staging plan gate did not report PASS"

actual_account="$(aws_call sts get-caller-identity --query Account --output text)"
[ "$actual_account" = "$ACCOUNT_ID" ] || fail "unexpected AWS account"

if [ "$TASK_SG_NAME" = "genesis-production-web-sg" ] || [ "$DB_IDENTIFIER" = "genesis-production-postgres" ]; then
  fail "production target detected"
fi

subnets_json="$(aws_call ec2 describe-subnets --subnet-ids "$PRIVATE_SUBNET_A" "$PRIVATE_SUBNET_B" --output json)"
jq -e --arg vpc "$VPC_ID" --arg a "$PRIVATE_SUBNET_A" --arg b "$PRIVATE_SUBNET_B" '
  (.Subnets | length == 2)
  and all(.Subnets[]; .VpcId == $vpc and .MapPublicIpOnLaunch == false)
  and ([.Subnets[].SubnetId] | sort == ([$a, $b] | sort))
  and ([.Subnets[].AvailabilityZone] | unique | length == 2)
' <<< "$subnets_json" >/dev/null || fail "approved database subnets are not two private subnets in the staging VPC"

route_tables_json="$(aws_call ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --output json)"
for subnet_id in "$PRIVATE_SUBNET_A" "$PRIVATE_SUBNET_B"; do
  jq -e --arg subnet "$subnet_id" '
    [.RouteTables[] | select(any(.Associations[]?; .SubnetId == $subnet))] as $explicit
    | (if ($explicit | length) > 0 then $explicit
       else [.RouteTables[] | select(any(.Associations[]?; .Main == true))]
       end) as $selected
    | ($selected | length == 1)
      and all($selected[].Routes[]?;
        ((.GatewayId // "") | startswith("igw-") | not)
      )
  ' <<< "$route_tables_json" >/dev/null || fail "approved subnet $subnet_id does not resolve to a private route table"
done

task_sg_json="$(aws_call ec2 describe-security-groups --group-ids "$TASK_SG_ID" --output json)"
jq -e --arg vpc "$VPC_ID" --arg name "$TASK_SG_NAME" '
  (.SecurityGroups | length == 1)
  and .SecurityGroups[0].VpcId == $vpc
  and .SecurityGroups[0].GroupName == $name
  and any(.SecurityGroups[0].Tags[]?; .Key == "Environment" and .Value == "staging")
' <<< "$task_sg_json" >/dev/null || fail "staging task security group identity does not match the approved source"

db_sg_json="$(aws_call ec2 describe-security-groups --filters "Name=group-name,Values=$DB_SECURITY_GROUP_NAME" "Name=vpc-id,Values=$VPC_ID" --output json)"
db_sg_id="$(jq -r '.SecurityGroups[0].GroupId // empty' <<< "$db_sg_json")"
if [ -n "$db_sg_id" ]; then
  jq -e --arg vpc "$VPC_ID" --arg name "$DB_SECURITY_GROUP_NAME" '
    (.SecurityGroups | length == 1)
    and .SecurityGroups[0].VpcId == $vpc
    and .SecurityGroups[0].GroupName == $name
    and any(.SecurityGroups[0].Tags[]?; .Key == "Environment" and .Value == "staging")
  ' <<< "$db_sg_json" >/dev/null || fail "database security group identity is ambiguous"
  jq -e --arg taskSg "$TASK_SG_ID" '
    (.SecurityGroups[0].IpPermissions | length <= 1)
    and all(.SecurityGroups[0].IpPermissions[];
      .IpProtocol == "tcp"
      and .FromPort == 5432
      and .ToPort == 5432
      and (.UserIdGroupPairs | length == 1)
      and .UserIdGroupPairs[0].GroupId == $taskSg
      and ((.IpRanges // []) | length == 0)
      and ((.Ipv6Ranges // []) | length == 0)
      and ((.PrefixListIds // []) | length == 0)
    )
  ' <<< "$db_sg_json" >/dev/null || fail "existing database security group has unapproved ingress; manual review required"
  jq -e '
    all(.SecurityGroups[0].IpPermissionsEgress[];
      .IpProtocol == "-1"
      and ((.IpRanges // []) | length == 1)
      and .IpRanges[0].CidrIp == "0.0.0.0/0"
      and ((.Ipv6Ranges // []) | length == 0)
      and ((.UserIdGroupPairs // []) | length == 0)
      and ((.PrefixListIds // []) | length == 0)
    )
    and (.SecurityGroups[0].IpPermissionsEgress | length <= 1)
  ' <<< "$db_sg_json" >/dev/null || fail "existing database security group has unapproved egress; manual review required"
fi

subnet_group_json="$(aws_optional rds describe-db-subnet-groups --db-subnet-group-name "$DB_SUBNET_GROUP" --output json)"
if [ -n "$subnet_group_json" ]; then
  jq -e --arg vpc "$VPC_ID" --arg a "$PRIVATE_SUBNET_A" --arg b "$PRIVATE_SUBNET_B" '
    (.DBSubnetGroups | length == 1)
    and .DBSubnetGroups[0].VpcId == $vpc
    and ([.DBSubnetGroups[0].Subnets[].SubnetIdentifier] | sort == ([$a, $b] | sort))
  ' <<< "$subnet_group_json" >/dev/null || fail "existing database subnet group differs from the approved private subnets"
  subnet_group_tags="$(aws_call rds list-tags-for-resource --resource-name "$DB_SUBNET_GROUP_ARN" --output json)"
  jq -e 'any(.TagList[]?; .Key == "Environment" and .Value == "staging")' <<< "$subnet_group_tags" >/dev/null ||
    fail "existing database subnet group is not tagged as staging"
fi

db_instance_json="$(aws_optional rds describe-db-instances --db-instance-identifier "$DB_IDENTIFIER" --output json)"
if [ -n "$db_instance_json" ]; then
  jq -e --arg subnetGroup "$DB_SUBNET_GROUP" --arg sg "$db_sg_id" '
    (.DBInstances | length == 1)
    and .DBInstances[0].Engine == "postgres"
    and (.DBInstances[0].EngineVersion | startswith("16."))
    and .DBInstances[0].DBInstanceClass == "db.t4g.micro"
    and .DBInstances[0].AllocatedStorage == 20
    and .DBInstances[0].StorageType == "gp3"
    and .DBInstances[0].StorageEncrypted == true
    and .DBInstances[0].PubliclyAccessible == false
    and .DBInstances[0].BackupRetentionPeriod == 7
    and .DBInstances[0].DeletionProtection == true
    and .DBInstances[0].MultiAZ == false
    and .DBInstances[0].DBName == "genesis_staging"
    and (.DBInstances[0].MasterUserSecret.SecretArn | startswith("arn:aws:secretsmanager:"))
    and .DBInstances[0].DBSubnetGroup.DBSubnetGroupName == $subnetGroup
    and ([.DBInstances[0].VpcSecurityGroups[].VpcSecurityGroupId] == [$sg])
  ' <<< "$db_instance_json" >/dev/null || fail "existing database instance does not satisfy the approved staging configuration"
  db_tags="$(aws_call rds list-tags-for-resource --resource-name "$DB_ARN" --output json)"
  jq -e 'any(.TagList[]?; .Key == "Environment" and .Value == "staging")' <<< "$db_tags" >/dev/null ||
    fail "existing database instance is not tagged as staging"
fi

app_secret_json="$(aws_optional secretsmanager describe-secret --secret-id "$APP_SECRET_NAME" --output json)"
if [ -n "$app_secret_json" ]; then
  jq -e --arg name "$APP_SECRET_NAME" '
    .Name == $name
    and any(.Tags[]?; .Key == "Environment" and .Value == "staging")
  ' <<< "$app_secret_json" >/dev/null || fail "existing database secret is not explicitly tagged as staging"
fi

printf 'STAGING_POSTGRES_TARGET=%s\n' "$DB_IDENTIFIER"
printf 'STAGING_POSTGRES_ENGINE=postgres:16.x\n'
printf 'STAGING_POSTGRES_CLASS=db.t4g.micro\n'
printf 'STAGING_POSTGRES_STORAGE=20GiB gp3 encrypted\n'
printf 'STAGING_POSTGRES_NETWORK=vpc:%s subnets:%s,%s public:false ingress:tcp/5432-from:%s\n' \
  "$VPC_ID" "$PRIVATE_SUBNET_A" "$PRIVATE_SUBNET_B" "$TASK_SG_ID"
printf 'STAGING_POSTGRES_BACKUPS=7-days deletion-protection:true multi-az:false\n'
printf 'STAGING_POSTGRES_SECRET=%s secret-values-read:false runtime-binding:deferred\n' "$APP_SECRET_NAME"

if [ "$MODE" = "plan" ]; then
  [ -n "$db_sg_id" ] || printf 'WOULD_CREATE_DB_SECURITY_GROUP=%s\n' "$DB_SECURITY_GROUP_NAME"
  if [ -n "$db_sg_id" ] && [ "$(jq '.SecurityGroups[0].IpPermissions | length' <<< "$db_sg_json")" = "0" ]; then
    printf 'WOULD_AUTHORIZE_DB_INGRESS=TCP/5432-from:%s\n' "$TASK_SG_ID"
  fi
  if [ -n "$db_sg_id" ] && [ "$(jq '.SecurityGroups[0].IpPermissionsEgress | length' <<< "$db_sg_json")" != "0" ]; then
    printf 'WOULD_REVOKE_DEFAULT_DB_SG_EGRESS=0.0.0.0/0\n'
  fi
  [ -n "$subnet_group_json" ] || printf 'WOULD_CREATE_DB_SUBNET_GROUP=%s\n' "$DB_SUBNET_GROUP"
  [ -n "$app_secret_json" ] || printf 'WOULD_CREATE_APP_SECRET=%s\n' "$APP_SECRET_NAME"
  [ -n "$db_instance_json" ] || printf 'WOULD_CREATE_DB_INSTANCE=%s\n' "$DB_IDENTIFIER"
  echo "STAGING_POSTGRES_PLAN=PASS"
  exit 0
fi

if [ -z "$db_sg_id" ]; then
  db_sg_id="$(aws_call ec2 create-security-group \
    --group-name "$DB_SECURITY_GROUP_NAME" \
    --description "Genesis staging PostgreSQL; ingress only from staging web tasks" \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$DB_SECURITY_GROUP_NAME},{Key=Environment,Value=staging}]" \
    --query GroupId --output text)"
  [[ "$db_sg_id" =~ ^sg-[[:xdigit:]]{8,17}$ ]] || fail "AWS returned an invalid database security group ID"
  aws_call ec2 authorize-security-group-ingress --group-id "$db_sg_id" --protocol tcp --port 5432 --source-group "$TASK_SG_ID" >/dev/null
elif [ "$(jq '.SecurityGroups[0].IpPermissions | length' <<< "$db_sg_json")" = "0" ]; then
  aws_call ec2 authorize-security-group-ingress --group-id "$db_sg_id" --protocol tcp --port 5432 --source-group "$TASK_SG_ID" >/dev/null
fi

db_sg_json="$(aws_call ec2 describe-security-groups --group-ids "$db_sg_id" --output json)"
if [ "$(jq '.SecurityGroups[0].IpPermissionsEgress | length' <<< "$db_sg_json")" != "0" ]; then
  aws_call ec2 revoke-security-group-egress --group-id "$db_sg_id" --protocol -1 --cidr 0.0.0.0/0 >/dev/null
fi

db_sg_json="$(aws_call ec2 describe-security-groups --group-ids "$db_sg_id" --output json)"
jq -e --arg vpc "$VPC_ID" --arg name "$DB_SECURITY_GROUP_NAME" --arg taskSg "$TASK_SG_ID" '
  (.SecurityGroups | length == 1)
  and .SecurityGroups[0].VpcId == $vpc
  and .SecurityGroups[0].GroupName == $name
  and any(.SecurityGroups[0].Tags[]?; .Key == "Environment" and .Value == "staging")
  and (.SecurityGroups[0].IpPermissionsEgress | length == 0)
  and (.SecurityGroups[0].IpPermissions | length == 1)
  and all(.SecurityGroups[0].IpPermissions[];
    .IpProtocol == "tcp"
    and .FromPort == 5432
    and .ToPort == 5432
    and (.UserIdGroupPairs | length == 1)
    and .UserIdGroupPairs[0].GroupId == $taskSg
    and ((.IpRanges // []) | length == 0)
    and ((.Ipv6Ranges // []) | length == 0)
    and ((.PrefixListIds // []) | length == 0)
  )
' <<< "$db_sg_json" >/dev/null || fail "database security group is not restricted to TCP/5432 from the staging task group"

if [ -z "$subnet_group_json" ]; then
  aws_call rds create-db-subnet-group \
    --db-subnet-group-name "$DB_SUBNET_GROUP" \
    --db-subnet-group-description "Private subnets for Genesis staging PostgreSQL certification" \
    --subnet-ids "$PRIVATE_SUBNET_A" "$PRIVATE_SUBNET_B" \
    --tags Key=Environment,Value=staging Key=Name,Value="$DB_SUBNET_GROUP" >/dev/null
  subnet_group_tags="$(aws_call rds list-tags-for-resource --resource-name "$DB_SUBNET_GROUP_ARN" --output json)"
  jq -e 'any(.TagList[]?; .Key == "Environment" and .Value == "staging")' <<< "$subnet_group_tags" >/dev/null ||
    fail "created database subnet group does not carry the staging tag"
fi

if [ -z "$app_secret_json" ]; then
  bash "$SCRIPT_DIR/create-postgres-app-secret.sh" \
    "$APP_SECRET_NAME" "$APP_SECRET_DESCRIPTION" "$DB_USERNAME" "$DATABASE_NAME" ||
    fail "unable to create the staging PostgreSQL application secret"
  app_secret_json="$(aws_call secretsmanager describe-secret --secret-id "$APP_SECRET_NAME" --output json)"
fi
app_secret_arn="$(jq -er '.ARN' <<< "$app_secret_json")"
[[ "$app_secret_arn" == arn:aws:secretsmanager:"$REGION":"$ACCOUNT_ID":secret:genesis/staging/postgres-* ]] ||
  fail "database secret ARN is outside the approved staging prefix"

if [ -z "$db_instance_json" ]; then
  aws_call rds create-db-instance \
    --db-instance-identifier "$DB_IDENTIFIER" \
    --engine postgres \
    --engine-version 16.13 \
    --db-instance-class db.t4g.micro \
    --allocated-storage 20 \
    --storage-type gp3 \
    --storage-encrypted \
    --manage-master-user-password \
    --master-username genesis_admin \
    --db-name "$DATABASE_NAME" \
    --db-subnet-group-name "$DB_SUBNET_GROUP" \
    --vpc-security-group-ids "$db_sg_id" \
    --no-publicly-accessible \
    --backup-retention-period 7 \
    --deletion-protection \
    --no-multi-az \
    --copy-tags-to-snapshot \
    --tags Key=Environment,Value=staging Key=Name,Value="$DB_IDENTIFIER" >/dev/null
  aws_call rds wait db-instance-available --db-instance-identifier "$DB_IDENTIFIER"
fi

verification="$(aws_call rds describe-db-instances --db-instance-identifier "$DB_IDENTIFIER" --output json)"
jq -e --arg subnetGroup "$DB_SUBNET_GROUP" --arg sg "$db_sg_id" '
  (.DBInstances | length == 1)
  and .DBInstances[0].DBInstanceStatus == "available"
  and .DBInstances[0].Engine == "postgres"
  and (.DBInstances[0].EngineVersion | startswith("16."))
  and .DBInstances[0].DBInstanceClass == "db.t4g.micro"
  and .DBInstances[0].AllocatedStorage == 20
  and .DBInstances[0].StorageType == "gp3"
  and .DBInstances[0].StorageEncrypted == true
  and .DBInstances[0].PubliclyAccessible == false
  and .DBInstances[0].BackupRetentionPeriod == 7
  and .DBInstances[0].DeletionProtection == true
  and .DBInstances[0].MultiAZ == false
  and .DBInstances[0].DBName == "genesis_staging"
  and (.DBInstances[0].MasterUserSecret.SecretArn | startswith("arn:aws:secretsmanager:"))
  and .DBInstances[0].DBSubnetGroup.DBSubnetGroupName == $subnetGroup
  and ([.DBInstances[0].VpcSecurityGroups[].VpcSecurityGroupId] == [$sg])
' <<< "$verification" >/dev/null || fail "created database does not satisfy the approved staging configuration"
db_tags="$(aws_call rds list-tags-for-resource --resource-name "$DB_ARN" --output json)"
jq -e 'any(.TagList[]?; .Key == "Environment" and .Value == "staging")' <<< "$db_tags" >/dev/null ||
  fail "created database does not carry the staging tag"

endpoint="$(jq -er '.DBInstances[0].Endpoint.Address' <<< "$verification")"
printf 'STAGING_POSTGRES_ENDPOINT=%s\n' "$endpoint"
printf 'STAGING_POSTGRES_SECRET_ARN=%s\n' "$app_secret_arn"
printf 'STAGING_POSTGRES_RUNTIME_BINDING=DEFERRED\n'
echo "STAGING_POSTGRES_INFRA=PASS"
