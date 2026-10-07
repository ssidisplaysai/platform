#!/usr/bin/env bash
# Genesis STAGING one-time infrastructure provisioning (idempotent).
#
#   provision.sh plan      - read-only: prints what apply would create/modify
#   provision.sh apply     - creates/converges staging infrastructure (no ECS service)
#   provision.sh service   - creates the genesis-staging-web ECS service (needs TASK_DEFINITION_ARN)
#   provision.sh env       - prints resolved non-secret values as KEY=VALUE
#
# Production resources are only ever READ (describe-*). Every mutating call is
# on a staging-named resource. Secret values are never printed.
set -euo pipefail

MODE="${1:-plan}"
REGION="${AWS_REGION:-us-west-2}"
export AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"

CLUSTER="genesis-production"
PROD_SERVICE="genesis-production-web"
STAGING_SERVICE="genesis-staging-web"
STAGING_TG_NAME="genesis-staging-web"
STAGING_HOST="staging.glwplatform.com"
WEBHOOK_PATH="/api/share-to-grow/woocommerce/webhook"
VPC_ID="vpc-05035503df7e142d6"
ECR_REPO="genesis-staging-runtime"
LOG_GROUP="/genesis/staging/web"
SECRET_NAME="genesis/staging/woocommerce-webhook-secret"
EXEC_ROLE_NAME="genesis-staging-execution-role"
EFS_NAME="genesis-staging-persistence"
EFS_SG_NAME="genesis-staging-efs"
EFS_AP_PATH="/genesis-staging-persistence"
WEBHOOK_RULE_PRIORITY=10
AUTH_RULE_PRIORITY=11
CONTAINER_NAME="GenesisWebRuntime"

for v in "$ECR_REPO" "$LOG_GROUP" "$SECRET_NAME" "$EXEC_ROLE_NAME" "$EFS_NAME" "$STAGING_SERVICE" "$STAGING_TG_NAME"; do
  case "$v" in *production*) echo "Refusing production-named target: $v" >&2; exit 1;; esac
done

log() { echo "[$MODE] $*" >&2; }
# mutate: executes in apply/service mode, only prints in plan mode.
mutate() {
  if [ "$MODE" = "plan" ]; then log "WOULD RUN: $*"; return 0; fi
  "$@"
}

# ---- read-only discovery -------------------------------------------------
PROD_SVC_JSON="$(aws ecs describe-services --cluster "$CLUSTER" --services "$PROD_SERVICE" --query 'services[0]' --output json)"
SUBNETS="$(echo "$PROD_SVC_JSON" | jq -r '.networkConfiguration.awsvpcConfiguration.subnets | join(",")')"
TASK_SG="$(echo "$PROD_SVC_JSON" | jq -r '.networkConfiguration.awsvpcConfiguration.securityGroups[0]')"
PROD_TG_ARN="$(echo "$PROD_SVC_JSON" | jq -r '.loadBalancers[0].targetGroupArn')"
PROD_TASKDEF="$(echo "$PROD_SVC_JSON" | jq -r '.taskDefinition')"
TASK_ROLE_ARN="$(aws ecs describe-task-definition --task-definition "$PROD_TASKDEF" --query 'taskDefinition.taskRoleArn' --output text)"
ALB_ARN="$(aws elbv2 describe-target-groups --target-group-arns "$PROD_TG_ARN" --query 'TargetGroups[0].LoadBalancerArns[0]' --output text)"
LISTENER_ARN="$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`443`].ListenerArn | [0]' --output text)"
STAGING_TG_ARN="$(aws elbv2 describe-target-groups --names "$STAGING_TG_NAME" --query 'TargetGroups[0].TargetGroupArn' --output text)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
[ "$ACCOUNT_ID" = "452630323448" ] || { echo "Unexpected AWS account $ACCOUNT_ID" >&2; exit 1; }
[ "$(aws elbv2 describe-target-groups --target-group-arns "$STAGING_TG_ARN" --query 'TargetGroups[0].VpcId' --output text)" = "$VPC_ID" ] || { echo "Staging TG not in expected VPC" >&2; exit 1; }
[ "$STAGING_TG_ARN" != "$PROD_TG_ARN" ] || { echo "Staging TG equals production TG" >&2; exit 1; }
EXEC_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${EXEC_ROLE_NAME}"

lookup_efs_id() {
  aws efs describe-file-systems --creation-token "$EFS_NAME" --query 'FileSystems[0].FileSystemId' --output text 2>/dev/null | sed 's/^None$//'
}
lookup_ap_id() {
  local fs="$1"; [ -n "$fs" ] || return 0
  aws efs describe-access-points --file-system-id "$fs" \
    --query "AccessPoints[?Tags[?Key=='Name'&&Value=='${EFS_NAME}']]|[0].AccessPointId" --output text 2>/dev/null | sed 's/^None$//'
}
lookup_secret_arn() {
  aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --query ARN --output text 2>/dev/null || true
}

if [ "$MODE" = "env" ]; then
  EFS_ID="$(lookup_efs_id)"
  cat <<EOF
EFS_FILE_SYSTEM_ID=$EFS_ID
EFS_ACCESS_POINT_ID=$(lookup_ap_id "$EFS_ID")
TASK_ROLE_ARN=$TASK_ROLE_ARN
EXECUTION_ROLE_ARN=$EXEC_ROLE_ARN
WEBHOOK_SECRET_ARN=$(lookup_secret_arn)
EOF
  exit 0
fi

if [ "$MODE" = "service" ]; then
  : "${TASK_DEFINITION_ARN:?TASK_DEFINITION_ARN is required}"
  SVC_STATUS="$(aws ecs describe-services --cluster "$CLUSTER" --services "$STAGING_SERVICE" --query 'services[0].status' --output text 2>/dev/null || true)"
  if [ "$SVC_STATUS" = "ACTIVE" ]; then
    log "service $STAGING_SERVICE already active"
  else
    aws ecs create-service --cluster "$CLUSTER" --service-name "$STAGING_SERVICE" --task-definition "$TASK_DEFINITION_ARN" \
      --desired-count 1 --launch-type FARGATE --platform-version LATEST \
      --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$TASK_SG],assignPublicIp=DISABLED}" \
      --load-balancers "targetGroupArn=$STAGING_TG_ARN,containerName=$CONTAINER_NAME,containerPort=3000" \
      --health-check-grace-period-seconds 60 \
      --deployment-configuration "minimumHealthyPercent=0,maximumPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
      --tags key=Environment,value=staging >/dev/null
  fi
  exit 0
fi

# ---- ECR -------------------------------------------------------------------
if aws ecr describe-repositories --repository-names "$ECR_REPO" >/dev/null 2>&1; then
  log "ECR $ECR_REPO exists"
else
  mutate aws ecr create-repository --repository-name "$ECR_REPO" --image-tag-mutability IMMUTABLE \
    --image-scanning-configuration scanOnPush=true --encryption-configuration encryptionType=AES256 \
    --tags Key=Environment,Value=staging >/dev/null
fi

# ---- CloudWatch log group --------------------------------------------------
if [ "$(aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --query "length(logGroups[?logGroupName=='$LOG_GROUP'])" --output text)" = "0" ]; then
  mutate aws logs create-log-group --log-group-name "$LOG_GROUP" --tags Environment=staging
else
  log "log group $LOG_GROUP exists"
fi
mutate aws logs put-retention-policy --log-group-name "$LOG_GROUP" --retention-in-days 30

# ---- Secrets Manager (value generated in AWS, never printed or committed) ---
SECRET_ARN="$(lookup_secret_arn)"
if [ -z "$SECRET_ARN" ] || [ "$SECRET_ARN" = "None" ]; then
  if [ "$MODE" = "plan" ]; then
    log "WOULD CREATE secret $SECRET_NAME with a random 48 char value generated by Secrets Manager"
    SECRET_ARN="arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:${SECRET_NAME}-PLACEHOLDER"
  else
    aws secretsmanager create-secret --name "$SECRET_NAME" --description "Genesis STAGING WooCommerce webhook HMAC secret" \
      --secret-string "$(aws secretsmanager get-random-password --password-length 48 --exclude-punctuation --query RandomPassword --output text)" \
      --tags Key=Environment,Value=staging >/dev/null
    SECRET_ARN="$(lookup_secret_arn)"
  fi
else
  log "secret $SECRET_NAME exists (value untouched)"
fi

# ---- Staging task execution role (production roles are not modified) --------
TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if aws iam get-role --role-name "$EXEC_ROLE_NAME" >/dev/null 2>&1; then
  log "role $EXEC_ROLE_NAME exists"
else
  mutate aws iam create-role --role-name "$EXEC_ROLE_NAME" --assume-role-policy-document "$TRUST" \
    --tags Key=Environment,Value=staging >/dev/null
fi
mutate aws iam attach-role-policy --role-name "$EXEC_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
SECRET_POLICY="$(jq -nc --arg a "$SECRET_ARN" '{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:["secretsmanager:GetSecretValue"],Resource:$a}]}')"
mutate aws iam put-role-policy --role-name "$EXEC_ROLE_NAME" --policy-name staging-webhook-secret-read --policy-document "$SECRET_POLICY"

# ---- EFS (staging-only persistence bridge) ----------------------------------
EFS_ID="$(lookup_efs_id)"
EFS_SG_ID="$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$EFS_SG_NAME" "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[0].GroupId' --output text | sed 's/^None$//')"
if [ -z "$EFS_SG_ID" ]; then
  if [ "$MODE" = "plan" ]; then
    log "WOULD CREATE security group $EFS_SG_NAME (ingress tcp/2049 from $TASK_SG only)"
  else
    EFS_SG_ID="$(aws ec2 create-security-group --group-name "$EFS_SG_NAME" --description "Genesis staging EFS (NFS from staging tasks)" --vpc-id "$VPC_ID" \
      --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$EFS_SG_NAME},{Key=Environment,Value=staging}]" --query GroupId --output text)"
    aws ec2 authorize-security-group-ingress --group-id "$EFS_SG_ID" --protocol tcp --port 2049 --source-group "$TASK_SG" >/dev/null
  fi
else
  log "EFS security group $EFS_SG_ID exists"
fi

if [ -z "$EFS_ID" ]; then
  if [ "$MODE" = "plan" ]; then
    log "WOULD CREATE encrypted EFS $EFS_NAME (generalPurpose, bursting), mount targets in each task subnet AZ, access point $EFS_AP_PATH uid/gid 1000"
  else
    EFS_ID="$(aws efs create-file-system --creation-token "$EFS_NAME" --encrypted --performance-mode generalPurpose --throughput-mode bursting \
      --tags Key=Name,Value="$EFS_NAME" Key=Environment,Value=staging --query FileSystemId --output text)"
    until [ "$(aws efs describe-file-systems --file-system-id "$EFS_ID" --query 'FileSystems[0].LifeCycleState' --output text)" = "available" ]; do sleep 5; done
  fi
else
  log "EFS $EFS_ID exists"
fi

if [ -n "$EFS_ID" ] && [ "$MODE" != "plan" ]; then
  aws efs put-backup-policy --file-system-id "$EFS_ID" --backup-policy Status=ENABLED >/dev/null
  SEEN_AZS=" $(aws efs describe-mount-targets --file-system-id "$EFS_ID" --query 'MountTargets[].AvailabilityZoneName' --output text | tr '\t' ' ') "
  for SUBNET in ${SUBNETS//,/ }; do
    AZ="$(aws ec2 describe-subnets --subnet-ids "$SUBNET" --query 'Subnets[0].AvailabilityZone' --output text)"
    case "$SEEN_AZS" in *" $AZ "*) continue;; esac
    aws efs create-mount-target --file-system-id "$EFS_ID" --subnet-id "$SUBNET" --security-groups "$EFS_SG_ID" >/dev/null
    SEEN_AZS="$SEEN_AZS$AZ "
  done
  until [ "$(aws efs describe-mount-targets --file-system-id "$EFS_ID" --query 'length(MountTargets[?LifeCycleState!=`available`])' --output text)" = "0" ]; do sleep 5; done
  AP_ID="$(lookup_ap_id "$EFS_ID")"
  if [ -z "$AP_ID" ]; then
    aws efs create-access-point --file-system-id "$EFS_ID" --posix-user Uid=1000,Gid=1000 \
      --root-directory "Path=$EFS_AP_PATH,CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=750}" \
      --tags Key=Name,Value="$EFS_NAME" Key=Environment,Value=staging >/dev/null
  fi
fi

# ---- Target group health check ---------------------------------------------
mutate aws elbv2 modify-target-group --target-group-arn "$STAGING_TG_ARN" \
  --health-check-protocol HTTP --health-check-port traffic-port --health-check-path /api/health \
  --matcher HttpCode=200 >/dev/null

# ---- ALB listener rules (staging host only; default action untouched) -------
RULES_JSON="$(aws elbv2 describe-rules --listener-arn "$LISTENER_ARN" --output json)"
COGNITO_ACTIONS="$(aws elbv2 describe-listeners --listener-arns "$LISTENER_ARN" --output json \
  | jq -c --arg tg "$STAGING_TG_ARN" '[.Listeners[0].DefaultActions[] | select(.Type=="authenticate-cognito") | .Order=1]
      + [{Type:"forward",Order:2,TargetGroupArn:$tg}]')"
if [ "$(echo "$COGNITO_ACTIONS" | jq 'map(select(.Type=="authenticate-cognito"))|length')" != "1" ]; then
  echo "Listener default action has no Cognito authentication to mirror; refusing to create an unauthenticated staging rule." >&2
  exit 1
fi
FORWARD_ONLY="$(jq -nc --arg tg "$STAGING_TG_ARN" '[{Type:"forward",Order:1,TargetGroupArn:$tg}]')"
HOST_COND="{\"Field\":\"host-header\",\"HostHeaderConfig\":{\"Values\":[\"$STAGING_HOST\"]}}"
WEBHOOK_CONDS="[$HOST_COND,{\"Field\":\"path-pattern\",\"PathPatternConfig\":{\"Values\":[\"$WEBHOOK_PATH\"]}},{\"Field\":\"http-request-method\",\"HttpRequestMethodConfig\":{\"Values\":[\"POST\"]}}]"
AUTH_CONDS="[$HOST_COND]"

ensure_rule() {
  local priority="$1" conds="$2" actions="$3" label="$4"
  local existing
  existing="$(echo "$RULES_JSON" | jq -r --arg p "$priority" '.Rules[] | select(.Priority==$p) | .RuleArn')"
  if [ -n "$existing" ]; then
    local owned
    owned="$(echo "$RULES_JSON" | jq -r --arg p "$priority" --arg h "$STAGING_HOST" \
      '.Rules[] | select(.Priority==$p) | [.Conditions[] | select(.Field=="host-header") | .HostHeaderConfig.Values[]] | index($h) // empty')"
    [ -n "$owned" ] || { echo "Priority $priority is used by a non-staging rule; refusing to overwrite." >&2; exit 1; }
    log "$label rule exists at priority $priority; converging"
    mutate aws elbv2 modify-rule --rule-arn "$existing" --conditions "$conds" --actions "$actions" >/dev/null
  else
    mutate aws elbv2 create-rule --listener-arn "$LISTENER_ARN" --priority "$priority" --conditions "$conds" --actions "$actions" >/dev/null
  fi
}
ensure_rule "$AUTH_RULE_PRIORITY" "$AUTH_CONDS" "$COGNITO_ACTIONS" "authenticated staging host"
ensure_rule "$WEBHOOK_RULE_PRIORITY" "$WEBHOOK_CONDS" "$FORWARD_ONLY" "webhook exception"

if [ "$MODE" = "plan" ]; then
  log "service creation happens in the deploy workflow (needs an image digest): desired 1, FARGATE, awsvpc, subnets=$SUBNETS sg=$TASK_SG, no public IP, grace 60s, min 0/max 100"
fi

log "done"