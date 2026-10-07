#!/usr/bin/env bash
# Genesis STAGING one-time infrastructure provisioning (idempotent).
#
#   provision.sh plan      - read-only: prints what apply would create/modify
#   provision.sh apply     - creates/converges staging infrastructure (no ECS service)
#   provision.sh service   - creates the genesis-staging-web ECS service (needs TASK_DEFINITION_ARN)
#   provision.sh env       - prints resolved non-secret values as KEY=VALUE
#   provision.sh render-taskdef - prints the staging task definition JSON (read-only; needs IMAGE_URI_WITH_DIGEST, GIT_COMMIT)
#
# Production resources are only ever READ (describe-*). Every mutating call is
# on a staging-named resource. Secret values are never printed.
set -euo pipefail

MODE="${1:-plan}"
case "$MODE" in plan|apply|service|env|render-taskdef) ;; *) echo "Unknown mode: $MODE" >&2; exit 2;; esac
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST="$HERE/runtime-env-allowlist.json"
PROD_TASKDEF_REF="genesis-production-web:38"
STAGING_SG_NAME="genesis-staging-web-sg"
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
TASK_ROLE_NAME="genesis-staging-task-role"
EFS_NAME="genesis-staging-persistence"
EFS_SG_NAME="genesis-staging-efs"
EFS_AP_PATH="/genesis-staging-persistence"
STAGING_COGNITO_CLIENT_NAME="genesis-staging-operators-client"
STAGING_CALLBACK_URL="https://${STAGING_HOST}/oauth2/idpresponse"
STAGING_LOGOUT_URL="https://${STAGING_HOST}/"
WEBHOOK_RULE_PRIORITY=10
AUTH_RULE_PRIORITY=11
CONTAINER_NAME="GenesisWebRuntime"

for v in "$ECR_REPO" "$LOG_GROUP" "$SECRET_NAME" "$EXEC_ROLE_NAME" "$TASK_ROLE_NAME" "$EFS_NAME" "$STAGING_SERVICE" "$STAGING_TG_NAME"; do
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
PROD_TASK_SG="$(echo "$PROD_SVC_JSON" | jq -r '.networkConfiguration.awsvpcConfiguration.securityGroups[0]')"
PROD_TG_ARN="$(echo "$PROD_SVC_JSON" | jq -r '.loadBalancers[0].targetGroupArn')"
PROD_SERVICE_TASKDEF="$(echo "$PROD_SVC_JSON" | jq -r '.taskDefinition')"
PROD_TD_JSON="$(aws ecs describe-task-definition --task-definition "$PROD_TASKDEF_REF" --query 'taskDefinition' --output json)"
PROD_CONT="$(echo "$PROD_TD_JSON" | jq -c --arg n "$CONTAINER_NAME" '.containerDefinitions[] | select(.name==$n)')"
[ -n "$PROD_CONT" ] || { echo "Container $CONTAINER_NAME not found in $PROD_TASKDEF_REF" >&2; exit 1; }
PROD_TASK_ROLE_ARN="$(echo "$PROD_TD_JSON" | jq -r '.taskRoleArn')" # reference only; never attached to staging
PROD_EXEC_ROLE_ARN="$(echo "$PROD_TD_JSON" | jq -r '.executionRoleArn')"
ALB_ARN="$(aws elbv2 describe-target-groups --target-group-arns "$PROD_TG_ARN" --query 'TargetGroups[0].LoadBalancerArns[0]' --output text)"
LISTENER_ARN="$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --query 'Listeners[?Port==`443`].ListenerArn | [0]' --output text)"
PROD_SG_JSON="$(aws ec2 describe-security-groups --group-ids "$PROD_TASK_SG" --query 'SecurityGroups[0]' --output json)"
# Ingress required by the runtime: container port 3000 from referenced security groups (the ALB). CIDR sources are reported but never mirrored.
SG_INGRESS_FROM_SGS="$(echo "$PROD_SG_JSON" | jq -r '[.IpPermissions[] | select(.IpProtocol=="tcp" and .FromPort<=3000 and .ToPort>=3000) | .UserIdGroupPairs[].GroupId] | unique | .[]')"
SG_INGRESS_SKIPPED="$(echo "$PROD_SG_JSON" | jq -c '[.IpPermissions[] | select((.IpProtocol=="tcp" and .FromPort<=3000 and .ToPort>=3000 and (.UserIdGroupPairs|length)>0)|not)] | map({protocol:.IpProtocol,from:.FromPort,to:.ToPort,cidrs:[.IpRanges[].CidrIp],sgs:[.UserIdGroupPairs[].GroupId]})')"
PROD_EGRESS_SUMMARY="$(echo "$PROD_SG_JSON" | jq -c '[.IpPermissionsEgress[] | {protocol:.IpProtocol,from:.FromPort,to:.ToPort,cidrs:[.IpRanges[].CidrIp]}]')"
[ -n "$SG_INGRESS_FROM_SGS" ] || { echo "No SG-sourced tcp/3000 ingress on $PROD_TASK_SG to mirror; refusing to guess." >&2; exit 1; }
STAGING_TG_ARN="$(aws elbv2 describe-target-groups --names "$STAGING_TG_NAME" --query 'TargetGroups[0].TargetGroupArn' --output text)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
[ "$ACCOUNT_ID" = "452630323448" ] || { echo "Unexpected AWS account $ACCOUNT_ID" >&2; exit 1; }
[ "$(aws elbv2 describe-target-groups --target-group-arns "$STAGING_TG_ARN" --query 'TargetGroups[0].VpcId' --output text)" = "$VPC_ID" ] || { echo "Staging TG not in expected VPC" >&2; exit 1; }
[ "$STAGING_TG_ARN" != "$PROD_TG_ARN" ] || { echo "Staging TG equals production TG" >&2; exit 1; }
EXEC_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${EXEC_ROLE_NAME}"
TASK_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${TASK_ROLE_NAME}"
[ "$TASK_ROLE_ARN" != "$PROD_TASK_ROLE_ARN" ] || { echo "Staging task role equals the production task role" >&2; exit 1; }

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

lookup_sg_id() {
  aws ec2 describe-security-groups --filters "Name=group-name,Values=$1" "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[0].GroupId' --output text | sed 's/^None$//'
}
STAGING_SG_ID="$(lookup_sg_id "$STAGING_SG_NAME")"

# Names/ARNs only. Environment values are only evaluated for the loopback check and are never printed.
CLASSIFIED="$(jq -nc --argjson c "$PROD_CONT" --slurpfile a "$ALLOWLIST" '
  $a[0] as $al
  | def denied($n): ($al.deny | index($n)) != null or any($al.denyPatterns[]; . as $p | $n | test($p));
    def cls($n; $secret; $val):
      if ($al.overrides | index($n)) then "overridden-by-staging"
      elif denied($n) then "denied"
      elif $secret then
        (if ($al.secrets.allow | index($n)) then "copy"
         elif ($al.secrets.reviewRequired | index($n)) then "excluded-review-required"
         else "unclassified-excluded" end)
      elif ($al.environment.allow | index($n)) then "copy"
      elif ($al.environment.allowIfLoopbackValue | index($n)) then
        (if ($val | test("^https?://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?(/|$)")) then "copy" else "excluded-non-loopback" end)
      else "unclassified-excluded" end;
    [ ($c.environment // [])[] | {name, kind:"environment", class: cls(.name; false; .value), value} ]
  + [ ($c.secrets // [])[] | {name, kind:"secret", source:.valueFrom, class: cls(.name; true; "")} ]')"
COPIED_SECRET_ARNS="$(echo "$CLASSIFIED" | jq -r '.[] | select(.kind=="secret" and .class=="copy" and (.source|startswith("arn:aws:secretsmanager:"))) | .source' | cut -d: -f1-7 | sort -u)"
if echo "$CLASSIFIED" | jq -e 'any(.[]; .kind=="secret" and .class=="copy" and (.source|startswith("arn:aws:secretsmanager:")|not))' >/dev/null; then
  echo "Allowlisted secret has a non-Secrets-Manager source; unsupported." >&2; exit 1
fi

render_taskdef() {
  : "${IMAGE_URI_WITH_DIGEST:?}" "${GIT_COMMIT:?}"
  EXECUTION_ROLE_ARN="$EXEC_ROLE_ARN"
  WEBHOOK_SECRET_ARN="$(lookup_secret_arn)"
  EFS_FILE_SYSTEM_ID="$(lookup_efs_id)"
  EFS_ACCESS_POINT_ID="$(lookup_ap_id "$EFS_FILE_SYSTEM_ID")"
  for r in "$TASK_ROLE_NAME" "$EXEC_ROLE_NAME"; do aws iam get-role --role-name "$r" >/dev/null 2>&1 || { echo "role $r missing; run Genesis Staging Infrastructure (apply) first" >&2; exit 1; }; done
  export TASK_ROLE_ARN EXECUTION_ROLE_ARN WEBHOOK_SECRET_ARN EFS_FILE_SYSTEM_ID EFS_ACCESS_POINT_ID
  for v in WEBHOOK_SECRET_ARN EFS_FILE_SYSTEM_ID EFS_ACCESS_POINT_ID; do
    [ -n "${!v}" ] || { echo "$v unresolved; run Genesis Staging Infrastructure (apply) first" >&2; exit 1; }
  done
  envsubst '${IMAGE_URI_WITH_DIGEST} ${GIT_COMMIT} ${TASK_ROLE_ARN} ${EXECUTION_ROLE_ARN} ${WEBHOOK_SECRET_ARN} ${EFS_FILE_SYSTEM_ID} ${EFS_ACCESS_POINT_ID}' \
    < "$HERE/task-definition.template.json" \
  | jq --argjson rows "$CLASSIFIED" '
      (.containerDefinitions[0]) as $c
      | ($c.environment | map(.name)) as $en | ($c.secrets | map(.name)) as $sn
      | .containerDefinitions[0].environment += [ $rows[] | select(.kind=="environment" and .class=="copy" and (.name as $n | $en | index($n) | not)) | {name, value} ]
      | .containerDefinitions[0].secrets += [ $rows[] | select(.kind=="secret" and .class=="copy" and (.name as $n | $sn | index($n) | not)) | {name, valueFrom:.source} ]'
}

# ---- DNS preflight (read-only; never changes DNS) ---------------------------
dns_preflight() {
  local alb_dns alb_ips host_ips cname
  alb_dns="$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text 2>/dev/null || true)"
  echo "DNS preflight for $STAGING_HOST (expected target: existing Genesis ALB ${alb_dns:-<ALB DNS unreadable: elasticloadbalancing:DescribeLoadBalancers?>})"
  host_ips="$(getent ahostsv4 "$STAGING_HOST" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)"
  cname="$(dig +short CNAME "$STAGING_HOST" 2>/dev/null | head -n1 || true)"
  if [ -z "$host_ips" ]; then
    echo "  RESULT: $STAGING_HOST does NOT resolve. Create a DNS record (CNAME/ALIAS) to ${alb_dns:-the Genesis ALB} before WooCommerce/Cognito can reach staging. DNS is not modified by this automation."
    return 0
  fi
  echo "  resolves to: $host_ips${cname:+ (CNAME $cname)}"
  if [ -n "$alb_dns" ] && [ "$alb_dns" != "None" ]; then
    alb_ips="$(getent ahostsv4 "$alb_dns" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)"
    if [ -n "$alb_ips" ] && [ -n "$(comm -12 <(echo "$host_ips" | tr ' ' '\n' | sort -u) <(echo "$alb_ips" | tr ' ' '\n' | sort -u) | grep . | head -n1)" ]; then
      echo "  RESULT: resolves to the Genesis ALB."
    else
      echo "  RESULT: resolves, but NOT to the Genesis ALB ($alb_dns -> ${alb_ips:-unresolved}). Verify the record target."
    fi
  fi
}

# ---- Staging Cognito client (separate from the production client) -----------
PROD_COG_ACTION="$(aws elbv2 describe-listeners --listener-arns "$LISTENER_ARN" --output json \
  | jq -c '[.Listeners[0].DefaultActions[] | select(.Type=="authenticate-cognito") | .AuthenticateCognitoConfig | del(.AuthenticationRequestExtraParams)] | .[0] // empty')"
COG_POOL_ID="$(echo "${PROD_COG_ACTION:-null}" | jq -r '(.UserPoolArn // "") | split("/") | last // ""')"
PROD_COG_CLIENT_ID="$(echo "${PROD_COG_ACTION:-null}" | jq -r '.UserPoolClientId // empty')"

lookup_staging_cognito_client_id() {
  aws cognito-idp list-user-pool-clients --user-pool-id "$COG_POOL_ID" --max-results 60 \
    --query "UserPoolClients[?ClientName=='${STAGING_COGNITO_CLIENT_NAME}'].ClientId | [0]" --output text 2>/dev/null | sed 's/^None$//' || true
}
# Builds the create-user-pool-client request from the PRODUCTION client's flow/scope/IdP/token settings.
# Only URLs, name and GenerateSecret differ. The production client is read, never modified.
staging_cognito_client_request() {
  aws cognito-idp describe-user-pool-client --user-pool-id "$COG_POOL_ID" --client-id "$PROD_COG_CLIENT_ID" --output json \
    | jq -c --arg pool "$COG_POOL_ID" --arg name "$STAGING_COGNITO_CLIENT_NAME" --arg cb "$STAGING_CALLBACK_URL" --arg lo "$STAGING_LOGOUT_URL" '
      .UserPoolClient | {
        UserPoolId: $pool, ClientName: $name, GenerateSecret: true,
        CallbackURLs: [$cb], LogoutURLs: [$lo], DefaultRedirectURI: $cb,
        AllowedOAuthFlows, AllowedOAuthScopes, AllowedOAuthFlowsUserPoolClient,
        SupportedIdentityProviders, ExplicitAuthFlows,
        RefreshTokenValidity, AccessTokenValidity, IdTokenValidity, TokenValidityUnits,
        PreventUserExistenceErrors, EnableTokenRevocation
      } | with_entries(select(.value != null))'
}
# $1 = existing staging client id (empty when it must be created)
ensure_staging_cognito_client() {
  [ -n "$COG_POOL_ID" ] && [ -n "$PROD_COG_CLIENT_ID" ] || { echo "Cannot derive user pool/client from the listener Cognito action." >&2; exit 1; }
  [ -z "${1:-}" ] || { log "Cognito client $STAGING_COGNITO_CLIENT_NAME exists (${1})"; return 0; }
  local req
  if ! req="$(staging_cognito_client_request 2>/dev/null)" || [ -z "$req" ]; then
    if [ "$MODE" = "plan" ]; then log "production Cognito client unreadable (needs cognito-idp:DescribeUserPoolClient); staging client settings cannot be derived yet"; return 0; fi
    echo "Cannot read production Cognito client settings to mirror; refusing to guess." >&2; exit 1
  fi
  if [ "$(echo "$req" | jq -r '((.AllowedOAuthFlows // []) | index("code")) != null')" != "true" ]; then
    echo "Production client does not use the authorization code flow; ALB requires it. Refusing." >&2; exit 1
  fi
  if [ "$MODE" = "plan" ]; then
    log "WOULD CREATE Cognito app client (request contains no secrets): $req"
  else
    aws cognito-idp create-user-pool-client --cli-input-json "$req" >/dev/null
  fi
}
STAGING_COG_CLIENT_ID="$(lookup_staging_cognito_client_id)"

# ---- Production image provenance (READ-ONLY; prints ONLY image URI, GIT_COMMIT, GENESIS_RUNTIME_SHA) -----
provenance_report() {
  local repo_root image git_commit runtime_sha repo_name id_arg c tag_c tied=0 v n
  repo_root="$(cd "$HERE/../.." && pwd)"
  image="$(echo "$PROD_CONT" | jq -r '.image')"
  git_commit="$(echo "$PROD_CONT" | jq -r '[(.environment // [])[] | select(.name=="GIT_COMMIT") | .value][0] // "<not set>"')"
  runtime_sha="$(echo "$PROD_CONT" | jq -r '[(.environment // [])[] | select(.name=="GENESIS_RUNTIME_SHA") | .value][0] // "<not set>"')"
  echo "=== Production image provenance (READ-ONLY; no other environment values are printed) ==="
  echo "production image URI: $image"
  echo "production GIT_COMMIT: $git_commit"
  echo "production GENESIS_RUNTIME_SHA: $runtime_sha"
  repo_name="$(echo "$image" | sed -E 's#^[^/]+/([^:@]+)([:@].*)?$#\1#')"
  case "$image" in
    *@sha256:*) id_arg="imageDigest=${image##*@}" ;;
    *:*) id_arg="imageTag=${image##*:}" ;;
    *) id_arg="" ;;
  esac
  if [ -n "$id_arg" ]; then
    echo "production ECR image metadata (tags/digest/push time only): $(aws ecr describe-images --repository-name "$repo_name" --image-ids "$id_arg" --query 'imageDetails[0].{tags:imageTags,digest:imageDigest,pushedAt:imagePushedAt}' --output json 2>&1 | jq -c . 2>/dev/null || echo '<unavailable: ecr:DescribeImages on the production repository>')"
  fi
  echo "comparison against commits in ssidisplaysai/platform (full-history checkout of $(git -C "$repo_root" rev-parse --short HEAD 2>/dev/null || echo '?')):"
  tag_c=""; case "$image" in *@*) ;; *:*) tag_c="${image##*:}" ;; esac
  for c in "$git_commit" "$runtime_sha" "$tag_c"; do
    echo "$c" | grep -Eq '^[0-9a-f]{7,40}$' || continue
    if git -C "$repo_root" cat-file -e "${c}^{commit}" 2>/dev/null; then
      tied=1
      echo "  $c: FOUND in this repository; contained in: $(git -C "$repo_root" branch -r --contains "$c" 2>/dev/null | tr -d ' ' | tr '\n' ' ' | head -c 300)"
    else
      echo "  $c: NOT FOUND in this repository's history"
    fi
  done
  if [ "$tied" = 1 ]; then
    echo "  RESULT: the production image CAN be tied to ssidisplaysai/platform."
  else
    echo "  RESULT: the production image CANNOT be tied to ssidisplaysai/platform from the discovered values (no resolvable commit SHA)."
  fi
  echo "production-only variables: referenced by this repository's runtime sources (src/, package.json, Dockerfile)?"
  for v in GENESIS_STATE_BACKEND GENESIS_RUNTIME_MODE GENESIS_OBJECT_STORE GENESIS_S3_ARTIFACT_BUCKET GENESIS_RDS_CA_CERT; do
    n="$(grep -rIl -- "$v" "$repo_root/src" "$repo_root/package.json" "$repo_root/Dockerfile" 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$n" = 0 ]; then echo "  $v: not referenced by repository code -> legacy/external runtime concern; stays EXCLUDED"
    else echo "  $v: referenced by $n file(s) -> requires review before any copy"; fi
  done
}

# ---- Simulate the PROPOSED policies (iam:SimulateCustomPolicy; read-only, independent of what is attached) --------
simulate_proposed() {
  local dir="$HERE/iam" pols=() f n i act res exp dec k v ctx pass=0 fail=0 line
  for f in "$dir"/0*.json; do pols+=("$(jq -c . "$f")"); done
  n="$(jq length "$dir/simulation-cases.json")"
  echo "=== Simulation of proposed policies (iam:SimulateCustomPolicy) ==="
  for i in $(seq 0 $((n - 1))); do
    act="$(jq -r ".[$i].action" "$dir/simulation-cases.json")"; res="$(jq -r ".[$i].resource" "$dir/simulation-cases.json")"; exp="$(jq -r ".[$i].expect" "$dir/simulation-cases.json")"
    ctx=()
    while IFS=$'\t' read -r k v; do
      [ -z "$k" ] || ctx+=("ContextKeyName=$k,ContextKeyValues=$v,ContextKeyType=string")
    done < <(jq -r ".[$i].context // {} | to_entries[] | [.key,.value] | @tsv" "$dir/simulation-cases.json")
    if [ "${#ctx[@]}" -gt 0 ]; then
      dec="$(aws iam simulate-custom-policy --policy-input-list "${pols[@]}" --action-names "$act" --resource-arns "$res" --context-entries "${ctx[@]}" --query 'EvaluationResults[0].EvalDecision' --output text 2>&1)" || { echo "  simulation unavailable (iam:SimulateCustomPolicy denied?): $(echo "$dec" | head -c 200)"; return 0; }
    else
      dec="$(aws iam simulate-custom-policy --policy-input-list "${pols[@]}" --action-names "$act" --resource-arns "$res" --query 'EvaluationResults[0].EvalDecision' --output text 2>&1)" || { echo "  simulation unavailable (iam:SimulateCustomPolicy denied?): $(echo "$dec" | head -c 200)"; return 0; }
    fi
    line="$act on ${res##*:} ctx=$(jq -c ".[$i].context" "$dir/simulation-cases.json") expected=$exp got=$dec"
    if { [ "$exp" = allow ] && [ "$dec" = allowed ]; } || { [ "$exp" = deny ] && [ "$dec" != allowed ]; }; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  MISMATCH: $line"; fi
  done
  echo "  proposed-policy simulation: $pass matched expectations, $fail mismatched"
}
report_plan_extras() {
  local role_name="GenesisGitHubDeployRole" caller_arn pool_arn client_id pool_id
  {
    echo "=== Production ingress/auth/health (READ-ONLY) ==="
    echo "listener: $LISTENER_ARN"
    echo "listener default action types: $(aws elbv2 describe-listeners --listener-arns "$LISTENER_ARN" --query 'Listeners[0].DefaultActions[].Type' --output text)"
    COG_CFG="$(aws elbv2 describe-listeners --listener-arns "$LISTENER_ARN" --output json | jq -c '[.Listeners[0].DefaultActions[] | select(.Type=="authenticate-cognito") | .AuthenticateCognitoConfig | del(.AuthenticationRequestExtraParams)]')"
    echo "cognito action config (no secrets exist in this object): $COG_CFG"
    pool_arn="$(echo "$COG_CFG" | jq -r '.[0].UserPoolArn // empty')"; client_id="$(echo "$COG_CFG" | jq -r '.[0].UserPoolClientId // empty')"
    pool_id="${pool_arn##*/}"
    if [ -n "$pool_id" ] && [ -n "$client_id" ]; then
      echo "production user pool client settings (ClientSecret deliberately dropped):"
      aws cognito-idp describe-user-pool-client --user-pool-id "$pool_id" --client-id "$client_id" --output json 2>&1 \
        | jq -c '.UserPoolClient | del(.ClientSecret) | {ClientName,GenerateSecret:false,CallbackURLs,LogoutURLs,AllowedOAuthFlows,AllowedOAuthScopes,AllowedOAuthFlowsUserPoolClient,SupportedIdentityProviders,RefreshTokenValidity,AccessTokenValidity,IdTokenValidity,TokenValidityUnits,PreventUserExistenceErrors,EnableTokenRevocation}' 2>&1 || echo "  unavailable (missing cognito-idp:DescribeUserPoolClient?)"
      echo "user pool domain: $(aws cognito-idp describe-user-pool --user-pool-id "$pool_id" --query 'UserPool.Domain' --output text 2>&1 | head -c 200)"
    fi
    echo "production target group health check: $(aws elbv2 describe-target-groups --target-group-arns "$PROD_TG_ARN" --query 'TargetGroups[0].{proto:HealthCheckProtocol,port:HealthCheckPort,path:HealthCheckPath,matcher:Matcher.HttpCode,interval:HealthCheckIntervalSeconds,timeout:HealthCheckTimeoutSeconds,healthy:HealthyThresholdCount,unhealthy:UnhealthyThresholdCount}' --output json | jq -c .)"
    echo "staging target group health check (current): $(aws elbv2 describe-target-groups --target-group-arns "$STAGING_TG_ARN" --query 'TargetGroups[0].{proto:HealthCheckProtocol,port:HealthCheckPort,path:HealthCheckPath,matcher:Matcher.HttpCode,protocolVersion:ProtocolVersion,targetType:TargetType,vpc:VpcId}' --output json | jq -c .)"
    echo "existing listener rules (priority/conditions/action types):"
    aws elbv2 describe-rules --listener-arn "$LISTENER_ARN" --output json | jq -c '.Rules[] | {priority:.Priority, conditions:[.Conditions[]|{f:.Field,v:(.Values)}], actions:[.Actions[].Type]}'
    echo "--- SNI certificates on listener ---"
    aws elbv2 describe-listener-certificates --listener-arn "$LISTENER_ARN" --query 'Certificates[].CertificateArn' --output text 2>&1 | head -c 600
    echo
    echo "=== Deploy role inspection (READ-ONLY) ==="
    caller_arn="$(aws sts get-caller-identity --query Arn --output text)"
    echo "caller (assumed via OIDC): $caller_arn"
    echo "trust policy of $role_name:"
    aws iam get-role --role-name "$role_name" --query 'Role.AssumeRolePolicyDocument' --output json 2>&1 | jq -c . 2>&1 || echo "  unavailable (iam:GetRole denied)"
    echo "attached managed policies:"
    aws iam list-attached-role-policies --role-name "$role_name" --query 'AttachedPolicies[].PolicyArn' --output text 2>&1 | head -c 800
    echo
    echo "inline policies: $(aws iam list-role-policies --role-name "$role_name" --query 'PolicyNames' --output text 2>&1 | head -c 400)"
    local actions="ecr:CreateRepository ecr:DescribeRepositories ecr:GetAuthorizationToken ecr:BatchCheckLayerAvailability ecr:InitiateLayerUpload ecr:UploadLayerPart ecr:CompleteLayerUpload ecr:PutImage ecr:DescribeImages logs:CreateLogGroup logs:PutRetentionPolicy logs:DescribeLogGroups secretsmanager:CreateSecret secretsmanager:DescribeSecret secretsmanager:GetRandomPassword iam:CreateRole iam:GetRole iam:AttachRolePolicy iam:PutRolePolicy iam:PassRole ec2:CreateSecurityGroup ec2:AuthorizeSecurityGroupIngress ec2:RevokeSecurityGroupIngress ec2:DescribeSecurityGroups ec2:DescribeSubnets ec2:CreateTags elasticfilesystem:CreateFileSystem elasticfilesystem:DescribeFileSystems elasticfilesystem:CreateMountTarget elasticfilesystem:DescribeMountTargets elasticfilesystem:CreateAccessPoint elasticfilesystem:DescribeAccessPoints elasticfilesystem:PutBackupPolicy elasticfilesystem:TagResource ecs:RegisterTaskDefinition ecs:DescribeTaskDefinition ecs:CreateService ecs:UpdateService ecs:DescribeServices elasticloadbalancing:DescribeRules elasticloadbalancing:DescribeListeners elasticloadbalancing:DescribeTargetGroups elasticloadbalancing:DescribeTargetHealth elasticloadbalancing:CreateRule elasticloadbalancing:ModifyRule elasticloadbalancing:ModifyTargetGroup cognito-idp:DescribeUserPoolClient cognito-idp:DescribeUserPool cognito-idp:ListUserPoolClients cognito-idp:CreateUserPoolClient iam:SimulateCustomPolicy ecr:DescribeImages elasticloadbalancing:DescribeListenerCertificates elasticloadbalancing:DescribeLoadBalancers elasticloadbalancing:AddTags iam:ListRolePolicies iam:GetRolePolicy iam:ListAttachedRolePolicies iam:SimulatePrincipalPolicy iam:TagRole"
    echo "SimulatePrincipalPolicy of the deploy role for required actions (read-only API):"
    # shellcheck disable=SC2086
    aws iam simulate-principal-policy --policy-source-arn "arn:aws:iam::${ACCOUNT_ID}:role/${role_name}" --action-names $actions --query 'EvaluationResults[].{a:EvalActionName,d:EvalDecision}' --output json 2>&1 \
      | jq -r 'if type=="array" then (map(select(.d!="allowed")) | if length==0 then "  all required actions allowed" else .[] | "  NOT ALLOWED: \(.a) (\(.d))" end) else . end' 2>&1 || echo "  simulation unavailable (iam:SimulatePrincipalPolicy denied)"
    echo "--- staging Cognito client (not created in plan) ---"
    echo "  name=$STAGING_COGNITO_CLIENT_NAME pool=${COG_POOL_ID:-?} GenerateSecret=true (ALB requirement) callback=$STAGING_CALLBACK_URL logout=$STAGING_LOGOUT_URL"
    echo "  existing staging client id: ${STAGING_COG_CLIENT_ID:-<none yet>}"
    echo "  flows/scopes/IdPs/token validity are mirrored from production client ${PROD_COG_CLIENT_ID:-?}"
    if [ -z "${STAGING_COG_CLIENT_ID:-}" ]; then staging_cognito_client_request 2>/dev/null | jq -c . || echo "  production client unreadable: settings cannot be shown (permissions)"; fi
    echo "  rule $AUTH_RULE_PRIORITY authenticate-cognito action will reference client: ${STAGING_COG_CLIENT_ID:-<new staging client id after create>} (never $PROD_COG_CLIENT_ID)"
    provenance_report
    simulate_proposed
    echo "=== DNS preflight (READ-ONLY) ==="
    dns_preflight
  } >&2
}
report_plan() {
  {
    echo "=== Production reference (READ-ONLY): $PROD_TASKDEF_REF (service currently runs: $PROD_SERVICE_TASKDEF) ==="
    echo "production task role ARN (reference only, NOT used by staging):      $PROD_TASK_ROLE_ARN"
    echo "production execution role ARN (reference only, NOT used by staging): $PROD_EXEC_ROLE_ARN"
    echo "STAGING task role ARN:      $TASK_ROLE_ARN (no application AWS permissions; EFS access is network/SG based)"
    echo "STAGING execution role ARN: $EXEC_ROLE_ARN"
    echo "production container keys: $(echo "$PROD_CONT" | jq -c 'keys')"
    echo "--- production environment variable NAMES and staging disposition ---"
    echo "$CLASSIFIED" | jq -r '.[] | select(.kind=="environment") | "  \(.name)\t\(.class)"'
    echo "--- production secret variable NAMES, source ARNs and staging disposition ---"
    echo "$CLASSIFIED" | jq -r '.[] | select(.kind=="secret") | "  \(.name)\t\(.source)\t\(.class)"'
    echo "--- staging overrides (never inherited) ---"
    jq -r '.overrides[] | "  " + .' "$ALLOWLIST"
    echo "--- security groups ---"
    echo "production task SG (read-only): $PROD_TASK_SG"
    echo "production tcp/3000 SG sources to mirror: $(echo "$SG_INGRESS_FROM_SGS" | tr '\n' ' ')"
    echo "production ingress NOT mirrored: $SG_INGRESS_SKIPPED"
    echo "production egress (reference): $PROD_EGRESS_SUMMARY"
    echo "staging task SG $STAGING_SG_NAME: ${STAGING_SG_ID:-<to be created>}"
    for src in $SG_INGRESS_FROM_SGS; do echo "  ingress tcp/3000 from $src"; done
    echo "  egress: all (default; required for ECR, Secrets Manager, CloudWatch Logs, EFS, outbound APIs)"
    echo "staging EFS SG $EFS_SG_NAME: ingress tcp/2049 ONLY from $STAGING_SG_NAME (${STAGING_SG_ID:-<to be created>})"
    echo "execution role $EXEC_ROLE_ARN may read: staging webhook secret$(echo "$COPIED_SECRET_ARNS" | sed 's/^/, /' | tr -d '\n')"
  } >&2
}
if [ "$MODE" = "render-taskdef" ]; then render_taskdef; exit 0; fi
if [ "$MODE" = "env" ]; then
  EFS_ID="$(lookup_efs_id)"
  cat <<EOF
EFS_FILE_SYSTEM_ID=$EFS_ID
EFS_ACCESS_POINT_ID=$(lookup_ap_id "$EFS_ID")
TASK_ROLE_ARN=$TASK_ROLE_ARN
EXECUTION_ROLE_ARN=$EXEC_ROLE_ARN
WEBHOOK_SECRET_ARN=$(lookup_secret_arn)
STAGING_SG_ID=$STAGING_SG_ID
EOF
  exit 0
fi

if [ "$MODE" = "service" ]; then
  : "${TASK_DEFINITION_ARN:?TASK_DEFINITION_ARN is required}"
  [ -n "$STAGING_SG_ID" ] || { echo "$STAGING_SG_NAME missing; run infrastructure apply first" >&2; exit 1; }
  [ "$STAGING_SG_ID" != "$PROD_TASK_SG" ] || { echo "Refusing to use the production task SG" >&2; exit 1; }
  SVC_STATUS="$(aws ecs describe-services --cluster "$CLUSTER" --services "$STAGING_SERVICE" --query 'services[0].status' --output text 2>/dev/null || true)"
  if [ "$SVC_STATUS" = "ACTIVE" ]; then
    log "service $STAGING_SERVICE already active"
  else
    aws ecs create-service --cluster "$CLUSTER" --service-name "$STAGING_SERVICE" --task-definition "$TASK_DEFINITION_ARN" \
      --desired-count 1 --launch-type FARGATE --platform-version LATEST \
      --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$STAGING_SG_ID],assignPublicIp=DISABLED}" \
      --load-balancers "targetGroupArn=$STAGING_TG_ARN,containerName=$CONTAINER_NAME,containerPort=3000" \
      --health-check-grace-period-seconds 60 \
      --deployment-configuration "minimumHealthyPercent=0,maximumPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
      --tags key=Environment,value=staging >/dev/null
  fi
  exit 0
fi

if [ "$MODE" = "plan" ]; then report_plan; report_plan_extras || true; fi

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
if aws iam get-role --role-name "$TASK_ROLE_NAME" >/dev/null 2>&1; then
  log "role $TASK_ROLE_NAME exists"
  ATT="$(aws iam list-attached-role-policies --role-name "$TASK_ROLE_NAME" --query "AttachedPolicies[].PolicyArn" --output text; aws iam list-role-policies --role-name "$TASK_ROLE_NAME" --query "PolicyNames" --output text)"
  [ -z "$(echo "$ATT" | tr -d "[:space:]")" ] || { echo "$TASK_ROLE_NAME must carry no permissions for the Share-to-Grow proof but has: $ATT" >&2; exit 1; }
else
  mutate aws iam create-role --role-name "$TASK_ROLE_NAME" --assume-role-policy-document "$TRUST" \
    --description "Genesis STAGING task role: intentionally no application AWS permissions" --tags Key=Environment,Value=staging >/dev/null
fi
mutate aws iam attach-role-policy --role-name "$EXEC_ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
SECRET_POLICY="$(jq -nc --arg a "$SECRET_ARN" --arg extra "$COPIED_SECRET_ARNS" '{Version:"2012-10-17",Statement:[{Effect:"Allow",Action:["secretsmanager:GetSecretValue"],Resource:([$a] + ($extra | split("\n") | map(select(length>0))))}]}')"
mutate aws iam put-role-policy --role-name "$EXEC_ROLE_NAME" --policy-name staging-webhook-secret-read --policy-document "$SECRET_POLICY"

# ---- EFS (staging-only persistence bridge) ----------------------------------
EFS_ID="$(lookup_efs_id)"
ensure_sg() {
  local name="$1" desc="$2" id
  id="$(lookup_sg_id "$name")"
  if [ -z "$id" ]; then
    if [ "$MODE" = "plan" ]; then log "WOULD CREATE security group $name in $VPC_ID"; return 0; fi
    id="$(aws ec2 create-security-group --group-name "$name" --description "$desc" --vpc-id "$VPC_ID" \
      --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$name},{Key=Environment,Value=staging}]" --query GroupId --output text)"
  else
    log "security group $name exists ($id)"
  fi
  echo "$id"
}
sg_has_ingress() { # group proto port source-group
  aws ec2 describe-security-groups --group-ids "$1" --query "SecurityGroups[0].IpPermissions[?IpProtocol=='$2'&&FromPort==\`$3\`&&ToPort==\`$3\`].UserIdGroupPairs[].GroupId" --output text | tr '\t' '\n' | grep -qx "$4"
}

STAGING_SG_ID="$(ensure_sg "$STAGING_SG_NAME" "Genesis staging web tasks")"
EFS_SG_ID="$(ensure_sg "$EFS_SG_NAME" "Genesis staging EFS (NFS from staging tasks only)")"
if [ "$MODE" != "plan" ]; then
  [ "$STAGING_SG_ID" != "$PROD_TASK_SG" ] || { echo "Refusing: staging SG resolved to production SG" >&2; exit 1; }
  for src in $SG_INGRESS_FROM_SGS; do
    sg_has_ingress "$STAGING_SG_ID" tcp 3000 "$src" || aws ec2 authorize-security-group-ingress --group-id "$STAGING_SG_ID" --protocol tcp --port 3000 --source-group "$src" >/dev/null
  done
  sg_has_ingress "$EFS_SG_ID" tcp 2049 "$STAGING_SG_ID" || aws ec2 authorize-security-group-ingress --group-id "$EFS_SG_ID" --protocol tcp --port 2049 --source-group "$STAGING_SG_ID" >/dev/null
  # EFS SG is staging-owned: remove any NFS source other than the staging task SG.
  for other in $(aws ec2 describe-security-groups --group-ids "$EFS_SG_ID" --query 'SecurityGroups[0].IpPermissions[?FromPort==`2049`].UserIdGroupPairs[].GroupId' --output text); do
    [ "$other" = "$STAGING_SG_ID" ] || aws ec2 revoke-security-group-ingress --group-id "$EFS_SG_ID" --protocol tcp --port 2049 --source-group "$other" >/dev/null
  done
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
# ---- Staging Cognito client, then rule 11 referencing it ---------------------
ensure_staging_cognito_client "$STAGING_COG_CLIENT_ID"
[ "$MODE" = "plan" ] || STAGING_COG_CLIENT_ID="$(lookup_staging_cognito_client_id)"
RULE_CLIENT_ID="${STAGING_COG_CLIENT_ID:-STAGING_CLIENT_ID_AFTER_CREATE}"
if [ "$MODE" != "plan" ] && { [ -z "$STAGING_COG_CLIENT_ID" ] || [ "$STAGING_COG_CLIENT_ID" = "$PROD_COG_CLIENT_ID" ]; }; then
  echo "Staging Cognito client missing or equal to the production client; refusing to build rule $AUTH_RULE_PRIORITY." >&2; exit 1
fi
COGNITO_ACTIONS="$(echo "$PROD_COG_ACTION" | jq -c --arg tg "$STAGING_TG_ARN" --arg cid "$RULE_CLIENT_ID" '
  [{Type:"authenticate-cognito",Order:1,AuthenticateCognitoConfig:(. | .UserPoolClientId=$cid)}]
  + [{Type:"forward",Order:2,TargetGroupArn:$tg}]')"
if [ "$(echo "$COGNITO_ACTIONS" | jq 'map(select(.Type=="authenticate-cognito"))|length')" != "1" ] || [ -z "$PROD_COG_ACTION" ]; then
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
    mutate aws elbv2 create-rule --listener-arn "$LISTENER_ARN" --priority "$priority" --conditions "$conds" --actions "$actions" --tags Key=Environment,Value=staging >/dev/null
  fi
}
ensure_rule "$AUTH_RULE_PRIORITY" "$AUTH_CONDS" "$COGNITO_ACTIONS" "authenticated staging host"
ensure_rule "$WEBHOOK_RULE_PRIORITY" "$WEBHOOK_CONDS" "$FORWARD_ONLY" "webhook exception"

if [ "$MODE" = "plan" ]; then
  log "service creation happens in the deploy workflow (needs an image digest): desired 1, FARGATE, awsvpc, subnets=$SUBNETS sg=${STAGING_SG_ID:-$STAGING_SG_NAME}, no public IP, grace 60s, min 0/max 100"
fi

if [ "$MODE" != "plan" ]; then dns_preflight >&2; fi

log "done"