import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const ACCOUNT_ID = "452630323448";
const REGION = "us-west-2";
const CLUSTER = "genesis-production";
const SERVICE_NAME = "genesis-staging-web";
const TASK_FAMILY = "genesis-staging-web";
const CONTAINER_NAME = "GenesisWebRuntime";
const TARGET_GROUP_ARN = `arn:aws:elasticloadbalancing:${REGION}:${ACCOUNT_ID}:targetgroup/genesis-staging-web/d729ca1a288ec4d1`;
const STAGING_SG_NAME = "genesis-staging-web-sg";
const PROTECTED_PRODUCTION_SECURITY_GROUPS = new Set([
  "sg-02f456f2dea97f1be",
  "sg-08117e5cf7cef2d09",
]);
const APPROVED_SUBNETS = new Set([
  "subnet-0f303dea5f645e42d",
  "subnet-00a0b287895a3b18c",
]);
const EXPECTED_VPC_ID = "vpc-05035503df7e142d6";
const READ_ACTIONS = new Set([
  "ecs:describe-services",
  "ecs:describe-task-definition",
  "ec2:describe-security-groups",
  "elbv2:describe-target-groups",
  "elbv2:describe-load-balancers",
  "elbv2:describe-target-health",
]);
const IAM_ACTION_NAMES = new Map([
  ["ecs:describe-services", "ecs:DescribeServices"],
  ["ecs:describe-task-definition", "ecs:DescribeTaskDefinition"],
  ["ec2:describe-security-groups", "ec2:DescribeSecurityGroups"],
  ["elbv2:describe-target-groups", "elasticloadbalancing:DescribeTargetGroups"],
  ["elbv2:describe-load-balancers", "elasticloadbalancing:DescribeLoadBalancers"],
  ["elbv2:describe-target-health", "elasticloadbalancing:DescribeTargetHealth"],
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requiredArray(value, label) {
  assert(Array.isArray(value), `${label} response is missing its required array`);
  return value;
}

function requiredObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} response is invalid`);
  return value;
}

function taskDefinitionRevision(arn) {
  const match = /^arn:aws:ecs:us-west-2:452630323448:task-definition\/genesis-staging-web:(\d+)$/.exec(arn ?? "");
  assert(match, `Unexpected staging task-definition ARN: ${String(arn)}`);
  const revision = Number(match[1]);
  assert(Number.isSafeInteger(revision) && revision > 0, "Staging task-definition revision is invalid");
  return revision;
}

function matcherIncludes200(matcher) {
  return typeof matcher === "string" && matcher.split(",").some((part) => {
    const match = /^(\d{3})(?:-(\d{3}))?$/.exec(part.trim());
    if (!match) return false;
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    return start <= 200 && end >= 200;
  });
}

function permissionResource(service, operation, args) {
  if (service === "ecs" && operation === "describe-services") {
    return `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:service/${CLUSTER}/${SERVICE_NAME}`;
  }
  if (service === "ecs" && operation === "describe-task-definition") {
    return args[args.indexOf("--task-definition") + 1] ?? "*";
  }
  if (service === "ec2" && operation === "describe-security-groups") {
    const groupId = args[args.indexOf("--group-ids") + 1];
    return groupId
      ? `arn:aws:ec2:${REGION}:${ACCOUNT_ID}:security-group/${groupId}`
      : "*";
  }
  if (service === "elbv2" && operation === "describe-target-groups") return TARGET_GROUP_ARN;
  if (service === "elbv2" && operation === "describe-load-balancers") {
    return args[args.indexOf("--load-balancer-arns") + 1] ?? "*";
  }
  if (service === "elbv2" && operation === "describe-target-health") return TARGET_GROUP_ARN;
  return "*";
}

function liveAwsCall(service, operation, args) {
  const action = `${service}:${operation}`.toLowerCase();
  assert(READ_ACTIONS.has(action), `Refusing non-approved AWS operation: ${service} ${operation}`);
  try {
    const output = execFileSync("aws", [service, operation, ...args, "--output", "json"], {
      encoding: "utf8",
      env: { ...process.env, AWS_REGION: REGION, AWS_DEFAULT_REGION: REGION },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(output);
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim();
    if (/AccessDenied|UnauthorizedOperation|not authorized|AccessDeniedException/i.test(detail)) {
      console.error(`READ_PERMISSION_GAP=${IAM_ACTION_NAMES.get(action)}/${permissionResource(service, operation, args)}`);
    }
    throw new Error(`AWS read failed (${service} ${operation}): ${detail}`);
  }
}

export async function inspectStagingRuntime({ call = liveAwsCall, report = console.log } = {}) {
  const serviceResponse = await call("ecs", "describe-services", [
    "--cluster", CLUSTER, "--services", SERVICE_NAME,
  ]);
  assert(requiredArray(serviceResponse.failures, "ECS describe-services failures").length === 0, "ECS service lookup returned failures");
  const services = requiredArray(serviceResponse.services, "ECS describe-services services");
  assert(services.length === 1, `Expected exactly one ${SERVICE_NAME} service; found ${services.length}`);
  const service = requiredObject(services[0], "ECS service");
  assert(service.serviceName === SERVICE_NAME, `Unexpected ECS service name: ${String(service.serviceName)}`);
  assert(typeof service.serviceArn === "string" && service.serviceArn.length > 0, "ECS service ARN is missing");
  assert(service.status === "ACTIVE", `ECS service status is ${String(service.status)}, expected ACTIVE`);
  assert(Number.isInteger(service.desiredCount) && service.desiredCount >= 1, "ECS desiredCount must be at least 1");
  assert(service.runningCount === service.desiredCount, "ECS runningCount does not match desiredCount");
  assert(service.pendingCount === 0, "ECS pendingCount must be zero");
  const deployments = requiredArray(service.deployments, "ECS deployments");
  const primaryDeployments = deployments.filter((deployment) => deployment?.status === "PRIMARY");
  assert(primaryDeployments.length === 1, "ECS service must have exactly one PRIMARY deployment");
  const primary = primaryDeployments[0];
  assert(primary.rolloutState === "COMPLETED", "ECS PRIMARY deployment rolloutState is not COMPLETED");
  assert(primary.taskDefinition === service.taskDefinition, "ECS PRIMARY task definition differs from the service task definition");
  const revision = taskDefinitionRevision(service.taskDefinition);
  assert(Number.isInteger(primary.desiredCount) && primary.desiredCount === service.desiredCount, "ECS PRIMARY desiredCount differs from the service");
  assert(primary.runningCount === primary.desiredCount, "ECS PRIMARY runningCount does not match desiredCount");
  assert(primary.pendingCount === 0, "ECS PRIMARY pendingCount must be zero");

  const taskResponse = await call("ecs", "describe-task-definition", ["--task-definition", service.taskDefinition]);
  const taskDefinition = requiredObject(taskResponse.taskDefinition, "ECS task definition");
  assert(taskDefinition.taskDefinitionArn === service.taskDefinition, "Described task definition does not match the live service task definition");
  assert(taskDefinition.family === TASK_FAMILY, `Unexpected task-definition family: ${String(taskDefinition.family)}`);
  assert(taskDefinitionRevision(taskDefinition.taskDefinitionArn) === revision, "Task-definition revision mismatch");
  assert(requiredArray(taskDefinition.requiresCompatibilities, "Task-definition compatibilities").includes("FARGATE"), "Task definition is not FARGATE compatible");
  assert(taskDefinition.networkMode === "awsvpc", "Task definition networkMode must be awsvpc");
  const containers = requiredArray(taskDefinition.containerDefinitions, "Task-definition containers");
  assert(containers.length === 1, `Expected exactly one staging runtime container; found ${containers.length}`);
  const container = containers[0];
  assert(container.name === CONTAINER_NAME, `Expected container ${CONTAINER_NAME}; found ${String(container.name)}`);
  assert(typeof container.image === "string" && container.image.length > 0, "Staging container image is missing");
  const portMappings = requiredArray(container.portMappings, "Container port mappings");
  assert(portMappings.some((mapping) => mapping.containerPort === 3000 && String(mapping.protocol).toLowerCase() === "tcp"), "Staging container must expose TCP/3000");

  const network = requiredObject(service.networkConfiguration?.awsvpcConfiguration, "ECS awsvpc network configuration");
  const subnets = requiredArray(network.subnets, "ECS service subnets");
  assert(subnets.length > 0 && subnets.every((subnet) => APPROVED_SUBNETS.has(subnet)), "ECS service uses a subnet outside the approved private subnet set");
  assert(network.assignPublicIp === "DISABLED", "ECS staging service must not assign public IP addresses");
  const securityGroupIds = requiredArray(network.securityGroups, "ECS service security groups");
  assert(securityGroupIds.length === 1, "ECS staging service must use exactly one staging web security group");
  const securityGroupId = securityGroupIds[0];
  assert(!PROTECTED_PRODUCTION_SECURITY_GROUPS.has(securityGroupId), `Production security group ${securityGroupId} is forbidden on staging`);
  const securityGroupResponse = await call("ec2", "describe-security-groups", ["--group-ids", securityGroupId]);
  const securityGroups = requiredArray(securityGroupResponse.SecurityGroups, "EC2 security groups");
  assert(securityGroups.length === 1, "Live staging security group is missing or ambiguous");
  const securityGroup = securityGroups[0];
  const securityGroupTags = Object.fromEntries(requiredArray(securityGroup.Tags ?? [], "Security group tags").map(({ Key, Value }) => [Key, Value]));
  assert(securityGroup.GroupId === securityGroupId, "Described security group ID differs from the ECS service group");
  assert(securityGroup.GroupName === STAGING_SG_NAME && securityGroupTags.Name === STAGING_SG_NAME, "Live ECS security group is not identified as the staging web security group");
  assert(securityGroupTags.Environment === "staging", "Live ECS security group is not tagged Environment=staging");
  assert(securityGroup.VpcId === EXPECTED_VPC_ID, "Live staging security group is not in the approved VPC");

  const targetGroupResponse = await call("elbv2", "describe-target-groups", ["--target-group-arns", TARGET_GROUP_ARN]);
  const targetGroups = requiredArray(targetGroupResponse.TargetGroups, "ELB target groups");
  assert(targetGroups.length === 1, "Staging target group is missing or ambiguous");
  const targetGroup = targetGroups[0];
  assert(targetGroup.TargetGroupArn === TARGET_GROUP_ARN, "Unexpected staging target group ARN");
  assert(targetGroup.TargetType === "ip", `Staging target type must be ip, found ${String(targetGroup.TargetType)}`);
  assert(targetGroup.Protocol === "HTTP", `Staging target protocol must be HTTP, found ${String(targetGroup.Protocol)}`);
  assert(targetGroup.Port === 3000, `Staging target-group port must be 3000, found ${String(targetGroup.Port)}`);
  assert(targetGroup.HealthCheckProtocol === "HTTP", "Staging target health-check protocol must be HTTP");
  assert(targetGroup.HealthCheckPath === "/api/health", "Staging target health-check path must be /api/health");
  assert(matcherIncludes200(targetGroup.Matcher?.HttpCode), `Staging target health-check matcher must include 200, found ${String(targetGroup.Matcher?.HttpCode)}`);

  const loadBalancerArns = requiredArray(targetGroup.LoadBalancerArns, "Staging target-group load balancers");
  assert(loadBalancerArns.length === 1, "Staging target group must be associated with exactly one load balancer");
  const loadBalancerResponse = await call("elbv2", "describe-load-balancers", ["--load-balancer-arns", loadBalancerArns[0]]);
  const loadBalancers = requiredArray(loadBalancerResponse.LoadBalancers, "Staging load balancers");
  assert(loadBalancers.length === 1, "Staging load balancer is missing or ambiguous");
  const loadBalancerSecurityGroups = requiredArray(loadBalancers[0].SecurityGroups, "ALB security groups");
  assert(loadBalancerSecurityGroups.length > 0, "Staging load balancer has no security groups");
  const ingressRules = requiredArray(securityGroup.IpPermissions, "Staging security group ingress rules");
  assert(ingressRules.some((rule) =>
    rule.IpProtocol === "tcp"
      && Number(rule.FromPort) <= 3000
      && Number(rule.ToPort) >= 3000
      && requiredArray(rule.UserIdGroupPairs ?? [], "Ingress source security groups")
        .some((source) => loadBalancerSecurityGroups.includes(source.GroupId))
  ), "Staging security group lacks TCP/3000 ingress from a staging load balancer security group");

  const serviceLoadBalancers = requiredArray(service.loadBalancers, "ECS service load balancers");
  assert(serviceLoadBalancers.some((attachment) =>
    attachment.targetGroupArn === TARGET_GROUP_ARN
      && attachment.containerName === CONTAINER_NAME
      && attachment.containerPort === 3000
  ), "ECS service is not attached to the staging target group at GenesisWebRuntime:3000");

  const targetHealthResponse = await call("elbv2", "describe-target-health", ["--target-group-arn", TARGET_GROUP_ARN]);
  const targets = requiredArray(targetHealthResponse.TargetHealthDescriptions, "Staging target health");
  assert(targets.length > 0, "Staging target group has no registered targets");
  for (const entry of targets) {
    const target = requiredObject(entry.Target, "Staging registered target");
    const health = requiredObject(entry.TargetHealth, "Staging target health state");
    report(`STAGING_TARGET=${target.Id}:${target.Port} STATE=${health.State} REASON=${health.Reason ?? "none"}`);
    assert(target.Port === 3000, `Registered staging target ${String(target.Id)} is not on port 3000`);
    assert(health.State === "healthy", `Staging target ${String(target.Id)}:${String(target.Port)} is ${String(health.State)} (${String(health.Reason ?? "no reason")})`);
  }

  report(`STAGING_SERVICE_ARN=${service.serviceArn}`);
  report(`STAGING_SERVICE_STATUS=${service.status}`);
  report(`STAGING_DESIRED_COUNT=${service.desiredCount}`);
  report(`STAGING_RUNNING_COUNT=${service.runningCount}`);
  report(`STAGING_PENDING_COUNT=${service.pendingCount}`);
  report(`STAGING_TASK_DEFINITION=${service.taskDefinition}`);
  report(`STAGING_TASK_DEFINITION_ARN=${taskDefinition.taskDefinitionArn}`);
  report(`STAGING_TASK_DEFINITION_FAMILY=${taskDefinition.family}`);
  report(`STAGING_TASK_DEFINITION_REVISION=${revision}`);
  report(`STAGING_CONTAINER_NAME=${container.name}`);
  report(`STAGING_CONTAINER_IMAGE=${container.image}`);
  report("STAGING_CONTAINER_PORT=3000/TCP");
  report(`STAGING_SUBNETS=${subnets.join(",")}`);
  report(`STAGING_SECURITY_GROUPS=${securityGroupIds.join(",")}`);
  report(`STAGING_ASSIGN_PUBLIC_IP=${network.assignPublicIp}`);
  report("STAGING_NETWORK_CONFIGURATION=PASS");
  report(`STAGING_TARGET_GROUP_ARN=${targetGroup.TargetGroupArn}`);
  report(`STAGING_TARGET_TYPE=${targetGroup.TargetType}`);
  report(`STAGING_TARGET_PROTOCOL=${targetGroup.Protocol}`);
  report(`STAGING_TARGET_PORT=${targetGroup.Port}`);
  report(`STAGING_HEALTH_CHECK_PROTOCOL=${targetGroup.HealthCheckProtocol}`);
  report(`STAGING_HEALTH_CHECK_PORT=${targetGroup.HealthCheckPort}`);
  report(`STAGING_HEALTH_CHECK_PATH=${targetGroup.HealthCheckPath}`);
  report(`STAGING_HEALTH_CHECK_MATCHER=${targetGroup.Matcher.HttpCode}`);
  report("STAGING_SERVICE_HEALTH=PASS");
  report("STAGING_TARGET_HEALTH=PASS");
  report("STAGING_PORT_ALIGNMENT=PASS");
  return { service, taskDefinition, container, network, securityGroup, targetGroup, targets };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  inspectStagingRuntime().catch((error) => {
    console.error(`STAGING_RUNTIME_INSPECTION=FAIL ${error.message}`);
    process.exitCode = 1;
  });
}
