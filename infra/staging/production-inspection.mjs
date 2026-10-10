import { spawnSync } from "node:child_process";

const ACCOUNT_ID = "452630323448";
const REGION = "us-west-2";
const ECR_REPOSITORY = "genesis-production-runtime";
const TASK_FAMILY = "genesis-production-web";
const TASK_CLUSTER = "genesis-production";
const TASK_SERVICE = "genesis-production-web";
const CLOUDFORMATION_STACK = "GenesisRuntimeStack";
const WEB_LOG_GROUP = "/genesis/production/web";
const DIGESTS = [
  "sha256:f0955c71791a7293969e1e49163e900073dcce06d01fc065e62c4bac7979d5ee",
  "sha256:fa8edfa7fd779a43d28e74ff6e479de2a3b4eb95cb964217f484ab47e0d8ce73",
];
const WINDOWS = [
  { label: "REV55", start: "2026-10-09T22:45:00Z", end: "2026-10-09T23:05:00Z" },
  { label: "REV56", start: "2026-10-09T23:15:00Z", end: "2026-10-09T23:35:00Z" },
];
const PROVENANCE_EVENTS = [
  "RegisterTaskDefinition", "UpdateService", "CreateChangeSet", "ExecuteChangeSet",
  "UpdateStack", "CreateStack", "InitiateLayerUpload", "UploadLayerPart",
  "CompleteLayerUpload", "PutImage",
];

export const READ_ONLY_AWS_CALLS = new Set([
  "sts:GetCallerIdentity",
  "ecs:DescribeServices", "ecs:DescribeTaskDefinition", "ecs:ListTaskDefinitions",
  "ecs:DescribeTasks", "ecs:ListTasks",
  "ecr:DescribeImages", "ecr:BatchGetImage", "ecr:ListImages",
  "cloudtrail:LookupEvents",
  "cloudformation:DescribeStacks", "cloudformation:DescribeStackEvents",
  "cloudformation:ListStackResources", "cloudformation:ListChangeSets",
  "cloudformation:DescribeChangeSet",
  "rds:DescribeDBInstances", "rds:DescribeDBClusters", "rds:DescribeDBSnapshots",
  "rds:DescribeDBClusterSnapshots", "rds:DescribeDBSubnetGroups",
  "ec2:DescribeSecurityGroups", "ec2:DescribeSubnets", "ec2:DescribeRouteTables",
  "ec2:DescribeVpcs", "ec2:DescribeNetworkInterfaces",
  "secretsmanager:DescribeSecret",
  "iam:GetRole", "iam:ListAttachedRolePolicies", "iam:ListRolePolicies",
  "iam:GetPolicy", "iam:GetPolicyVersion", "iam:GetRolePolicy",
  "cloudwatch:DescribeAlarms",
  "logs:DescribeLogGroups", "logs:DescribeLogStreams",
]);
const SENSITIVE_ENVIRONMENT_NAME = /secret|password|token|key|credential/i;

function operationPermission(operation) {
  return operation.split("-").map((part) =>
    part.toLowerCase() === "db" ? "DB" : `${part[0].toUpperCase()}${part.slice(1)}`).join("");
}

const SAFE_REQUEST_KEYS = new Set([
  "taskDefinition", "family", "service", "cluster", "repositoryName", "imageTag",
  "imageDigest", "stackName", "changeSetName", "dbInstanceIdentifier",
  "dbClusterIdentifier", "secretId", "roleName", "groupName", "vpcId",
]);

function emit(label, value) {
  console.log(`${label}=${JSON.stringify(value)}`);
}

export function isAccessDenied(message) {
  return /AccessDenied|AccessDeniedException|UnauthorizedOperation|not authorized/i.test(String(message));
}

export function sanitizeRequestParameters(parameters = {}) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return {};
  const result = {};
  for (const key of SAFE_REQUEST_KEYS) {
    const value = parameters[key];
    if (typeof value === "string" || typeof value === "number") result[key] = value;
    else if (Array.isArray(value)) {
      result[key] = value.filter((item) => typeof item === "string" || typeof item === "number");
    } else if (key === "taskDefinition" && value && typeof value === "object") {
      result[key] = {
        family: value.family,
        revision: value.revision,
        taskDefinitionArn: value.taskDefinitionArn,
      };
    }
  }
  return result;
}

export function sanitizeCloudTrailEvent(event) {
  const identity = event.userIdentity ?? {};
  const session = identity.sessionContext?.sessionIssuer ?? {};
  const request = event.requestParameters ?? {};
  const response = event.responseElements ?? {};
  const rawTask = request.taskDefinition;
  const responseTask = response.taskDefinition;
  const taskArn = typeof rawTask === "string" ? rawTask
    : rawTask?.taskDefinitionArn ?? (typeof responseTask === "string" ? responseTask : responseTask?.taskDefinitionArn);
  const revisionMatch = typeof taskArn === "string" ? taskArn.match(/genesis-production-web:(\d+)$/) : null;
  const principalArn = identity.arn ?? null;
  return {
    eventTime: event.eventTime ?? null,
    eventName: event.eventName ?? null,
    username: identity.userName ?? identity.sessionContext?.sessionIssuer?.userName ?? null,
    principalArn,
    assumedRoleArn: session.arn ?? null,
    roleSessionName: typeof identity.principalId === "string" ? identity.principalId.split(":").slice(1).join(":") || null : null,
    invokedBy: identity.invokedBy ?? null,
    userAgent: event.userAgent ?? null,
    sourceIPAddress: event.sourceIPAddress ?? null,
    requestParameters: sanitizeRequestParameters(request),
    taskDefinitionArn: taskArn ?? null,
    taskDefinitionRevision: revisionMatch ? Number(revisionMatch[1]) : null,
    responseTaskDefinitionArn: typeof responseTask === "string" ? responseTask : responseTask?.taskDefinitionArn ?? null,
    ecsService: request.service ?? null,
    ecsCluster: request.cluster ?? null,
    stackName: request.stackName ?? null,
    changeSetName: request.changeSetName ?? request.changeSet ?? null,
    repositoryName: request.repositoryName ?? null,
  };
}

export function evaluateSecurityGroupPath({ taskGroupIds, taskVpcId, taskSubnets, dbSecurityGroups, dbVpcId, dbPort }) {
  const taskGroups = new Set(taskGroupIds ?? []);
  const sameVpc = Boolean(taskVpcId && dbVpcId && taskVpcId === dbVpcId);
  const subnetRoutes = (taskSubnets ?? []).map((subnet) => ({
    subnetId: subnet.subnetId,
    vpcId: subnet.vpcId,
    sameVpc: subnet.vpcId === dbVpcId,
  }));
  const ingress = [];
  for (const group of dbSecurityGroups ?? []) {
    for (const permission of group.ipPermissions ?? []) {
      const portAllowed = permission.ipProtocol === "-1"
        || (permission.ipProtocol === "tcp" && permission.fromPort <= dbPort && permission.toPort >= dbPort);
      if (!portAllowed) continue;
      for (const source of permission.userIdGroupPairs ?? []) {
        if (taskGroups.has(source.groupId)) {
          ingress.push({ dbSecurityGroupId: group.groupId, sourceGroupId: source.groupId, dbPort });
        }
      }
    }
  }
  return {
    sameVpc,
    subnetRoutes,
    securityGroupIngressFromTask: ingress,
    configurationAllows: sameVpc && subnetRoutes.some((subnet) => subnet.sameVpc) && ingress.length > 0,
  };
}

export function sanitizeSecretMetadata(secret) {
  return {
    name: secret.name ?? null,
    arn: secret.arn ?? null,
    description: secret.description ?? null,
    kmsKeyId: secret.kmsKeyId ?? null,
    lastChangedDate: secret.lastChangedDate ?? null,
    lastAccessedDate: secret.lastAccessedDate ?? null,
    rotationEnabled: secret.rotationEnabled ?? null,
    rotationRules: secret.rotationRules ?? null,
  };
}

export function filterTaskDefinition(task, revision) {
  if (!task || task.family !== TASK_FAMILY || task.revision !== revision) return false;
  return true;
}

export function taskDefinitionArnsToInspect(taskDefinitionArns, currentTaskDefinitionArn) {
  return [...new Set([
    ...asArray(taskDefinitionArns),
    ...[55, 56, 57].map((revision) =>
      `arn:aws:ecs:${REGION}:${ACCOUNT_ID}:task-definition/${TASK_FAMILY}:${revision}`),
    currentTaskDefinitionArn,
  ].filter(Boolean))];
}

export function productionImageReference(image) {
  const match = image?.match(new RegExp(`/${ECR_REPOSITORY}(?:[:@])([^\\s]+)$`));
  if (!match) return null;
  const reference = match[1];
  return {
    imageId: reference.startsWith("sha256:") ? `imageDigest=${reference}` : `imageTag=${reference}`,
    tag: reference.startsWith("sha256:") ? null : reference,
  };
}

export function isTrackedImageDigest(digest) {
  return DIGESTS.includes(digest);
}

export function summarizeRdsResource(item) {
  return {
    identifier: item.DBInstanceIdentifier ?? item.DBClusterIdentifier ?? item.DBSnapshotIdentifier ?? item.DBClusterSnapshotIdentifier ?? item.DBSubnetGroupName,
    engine: item.Engine,
    engineVersion: item.EngineVersion,
    endpoint: item.Endpoint ? { address: item.Endpoint.Address, port: item.Endpoint.Port, hostedZoneId: item.Endpoint.HostedZoneId } : null,
    status: item.DBInstanceStatus ?? item.Status,
    multiAZ: item.MultiAZ ?? item.MultiAZCapable,
    storageEncrypted: item.StorageEncrypted,
    kmsKeyId: item.KmsKeyId,
    backupRetentionPeriod: item.BackupRetentionPeriod,
    latestRestorableTime: item.LatestRestorableTime,
    snapshotCreateTime: item.SnapshotCreateTime,
    deletionProtection: item.DeletionProtection,
    publiclyAccessible: item.PubliclyAccessible,
    dbSubnetGroup: item.DBSubnetGroup?.DBSubnetGroupName ?? item.DBSubnetGroupName,
    vpcId: item.DBSubnetGroup?.VpcId ?? item.VpcId,
    securityGroups: asArray(item.VpcSecurityGroups).map(({ VpcSecurityGroupId, Status }) => ({ id: VpcSecurityGroupId, status: Status })),
    port: item.Port,
  };
}

export function summarizeAlarm(alarm) {
  return {
    name: alarm.AlarmName,
    type: alarm.AlarmRule ? "CompositeAlarm" : "MetricAlarm",
    state: alarm.StateValue,
    actionsEnabled: alarm.ActionsEnabled,
    alarmRule: alarm.AlarmRule,
    namespace: alarm.Namespace,
    metric: alarm.MetricName,
    metrics: asArray(alarm.Metrics).map(({ Id, Label, MetricStat }) => ({
      id: Id,
      label: Label,
      namespace: MetricStat?.Metric?.Namespace,
      metric: MetricStat?.Metric?.MetricName,
      dimensions: MetricStat?.Metric?.Dimensions,
      period: MetricStat?.Period,
      statistic: MetricStat?.Stat,
    })),
    dimensions: alarm.Dimensions,
    threshold: alarm.Threshold,
    evaluationPeriods: alarm.EvaluationPeriods,
    comparisonOperator: alarm.ComparisonOperator,
  };
}

export function summarizeAlarmInventory(response) {
  return [
    ...asArray(response.MetricAlarms),
    ...asArray(response.CompositeAlarms),
  ].map(summarizeAlarm);
}

function aws(service, operation, args = [], region = REGION, gaps = new Set()) {
  const permission = `${service}:${operationPermission(operation)}`;
  if (!READ_ONLY_AWS_CALLS.has(permission)) throw new Error(`Refusing non-allowlisted AWS call: ${permission}`);
  const result = spawnSync("aws", [service, operation, ...args, "--region", region, "--output", "json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const message = result.stderr || result.stdout || "AWS CLI failed";
    if (isAccessDenied(message)) {
      gaps.add(permission);
      return { __accessDenied: true };
    }
    console.log(`INSPECTION_QUERY_FAILED=${permission}`);
    return { __queryFailed: true };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    console.log(`INSPECTION_INVALID_JSON=${permission}`);
    return { __queryFailed: true };
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cloudTrailWindow(label, start, end, gaps, taskDefinitionArns = [], imageTags = []) {
  const events = [];
  const taskArnSet = new Set(taskDefinitionArns);
  for (const eventName of PROVENANCE_EVENTS) {
    const response = aws("cloudtrail", "lookup-events", [
      "--lookup-attributes", `AttributeKey=EventName,AttributeValue=${eventName}`,
      "--start-time", start, "--end-time", end, "--max-results", "50",
    ], REGION, gaps);
    if (response.__accessDenied || response.__queryFailed) continue;
    for (const item of asArray(response.Events)) {
      try {
        const event = JSON.parse(item.CloudTrailEvent ?? "{}");
        const sanitized = sanitizeCloudTrailEvent(event);
        const raw = event.requestParameters ?? {};
        const responseTask = event.responseElements?.taskDefinition;
        const taskArn = sanitized.taskDefinitionArn ?? sanitized.responseTaskDefinitionArn;
        const relevantTask = taskArnSet.has(taskArn)
          || /genesis-production-web:(55|56|57)$/.test(taskArn ?? "")
          || raw.family === TASK_FAMILY
          || raw.service === TASK_SERVICE;
        const relevantImage = raw.repositoryName === ECR_REPOSITORY
          && (imageTags.length === 0 || imageTags.includes(raw.imageTag));
        const relevantStack = String(raw.stackName ?? raw.stackId ?? "").includes(CLOUDFORMATION_STACK);
        if (relevantTask || relevantImage || relevantStack) {
          events.push(sanitized);
        }
        void responseTask;
      } catch {
        console.log(`CLOUDTRAIL_EVENT_PARSE_FAILED=${label}:${eventName}`);
      }
    }
  }
  emit(`${label}_CLOUDTRAIL_EVENTS`, events);
}

function inspect(gaps) {
  const identity = aws("sts", "get-caller-identity", [], REGION, gaps);
  if (!identity.__accessDenied && identity.Account !== ACCOUNT_ID) {
    throw new Error(`Unexpected AWS account ${identity.Account}`);
  }
  emit("INSPECTION_AWS_IDENTITY", identity.__accessDenied ? "ACCESS_DENIED" : { account: identity.Account, arn: identity.Arn });

  const services = aws("ecs", "describe-services", [
    "--cluster", TASK_CLUSTER, "--services", TASK_SERVICE,
  ], REGION, gaps);
  const service = asArray(services.services)[0];
  if (service) {
    emit("PRODUCTION_SERVICE", {
      name: service.serviceName, status: service.status, taskDefinition: service.taskDefinition,
      desiredCount: service.desiredCount, runningCount: service.runningCount, pendingCount: service.pendingCount,
      deployments: asArray(service.deployments).map(({ id, status, taskDefinition, desiredCount, runningCount, pendingCount, rolloutState, createdAt, updatedAt }) =>
        ({ id, status, taskDefinition, desiredCount, runningCount, pendingCount, rolloutState, createdAt, updatedAt })),
      taskSecurityGroups: service.networkConfiguration?.awsvpcConfiguration?.securityGroups ?? [],
      subnetIds: service.networkConfiguration?.awsvpcConfiguration?.subnets ?? [],
      targetGroups: asArray(service.loadBalancers).map((item) => item.targetGroupArn),
    });
  }

  const defs = aws("ecs", "list-task-definitions", [
    "--family-prefix", TASK_FAMILY, "--sort", "DESC", "--max-items", "10",
  ], REGION, gaps);
  const taskArns = taskDefinitionArnsToInspect(defs.taskDefinitionArns, service?.taskDefinition);
  const taskDefinitions = [];
  for (const arn of taskArns) {
    const response = aws("ecs", "describe-task-definition", ["--task-definition", arn, "--include", "TAGS"], REGION, gaps);
    const task = response.taskDefinition;
    if (!task) continue;
    const containers = asArray(task.containerDefinitions).map((container) => ({
      name: container.name,
      image: container.image,
      environment: asArray(container.environment).map(({ name, value }) => ({
        name,
        value: SENSITIVE_ENVIRONMENT_NAME.test(name ?? "") ? "<redacted>" : value,
      })),
      secrets: asArray(container.secrets).map(({ name, valueFrom }) => ({ name, valueFrom })),
      mounts: container.mountPoints,
    }));
    taskDefinitions.push({
      taskDefinitionArn: task.taskDefinitionArn, family: task.family, revision: task.revision,
      status: task.status, registeredAt: task.registeredAt, registeredBy: task.registeredBy,
      taskRoleArn: task.taskRoleArn, executionRoleArn: task.executionRoleArn,
      cpu: task.cpu, memory: task.memory, networkMode: task.networkMode, volumes: task.volumes,
      containers,
    });
    if ([55, 56, 57].includes(task.revision)) emit(`PRODUCTION_TASK_DEFINITION_${task.revision}`, taskDefinitions.at(-1));
    if (task.taskDefinitionArn === service?.taskDefinition) {
      emit("PRODUCTION_CURRENT_TASK_DEFINITION", taskDefinitions.at(-1));
    }
    for (const roleArn of [task.taskRoleArn, task.executionRoleArn].filter(Boolean)) {
      const roleName = roleArn.split("/").at(-1);
      const role = aws("iam", "get-role", ["--role-name", roleName], REGION, gaps);
      if (!role.__accessDenied && !role.__queryFailed) {
        emit("PRODUCTION_IAM_ROLE", {
          role: role.Role ? { arn: role.Role.Arn, createDate: role.Role.CreateDate, path: role.Role.Path } : null,
          name: roleName,
        });
      }
      const attached = aws("iam", "list-attached-role-policies", ["--role-name", roleName], REGION, gaps);
      emit("PRODUCTION_IAM_ATTACHED_POLICIES", {
        role: roleName,
        policies: asArray(attached.AttachedPolicies).map(({ PolicyName, PolicyArn }) => ({ PolicyName, PolicyArn })),
      });
      const inline = aws("iam", "list-role-policies", ["--role-name", roleName], REGION, gaps);
      emit("PRODUCTION_IAM_INLINE_POLICY_NAMES", { role: roleName, names: asArray(inline.PolicyNames) });
      for (const policy of asArray(attached.AttachedPolicies)) {
        const detail = aws("iam", "get-policy", ["--policy-arn", policy.PolicyArn], REGION, gaps);
        const versionId = detail.Policy?.DefaultVersionId;
        if (versionId) aws("iam", "get-policy-version", ["--policy-arn", policy.PolicyArn, "--version-id", versionId], REGION, gaps);
      }
      for (const policyName of asArray(inline.PolicyNames)) {
        aws("iam", "get-role-policy", ["--role-name", roleName, "--policy-name", policyName], REGION, gaps);
      }
    }
    for (const secret of containers.flatMap((container) => container.secrets ?? [])) {
      const arn = secret.valueFrom?.split(":").slice(0, 7).join(":");
      if (!arn) continue;
      const metadata = aws("secretsmanager", "describe-secret", ["--secret-id", arn], REGION, gaps);
      if (!metadata.__accessDenied && !metadata.__queryFailed) emit("SECRET_METADATA", sanitizeSecretMetadata(metadata));
    }
  }

  const tasks = aws("ecs", "list-tasks", ["--cluster", TASK_CLUSTER, "--service-name", TASK_SERVICE], REGION, gaps);
  const taskDetails = aws("ecs", "describe-tasks", ["--cluster", TASK_CLUSTER, "--tasks", ...asArray(tasks.taskArns)], REGION, gaps);
  emit("PRODUCTION_RUNNING_TASKS", asArray(taskDetails.tasks).map((task) => ({
    taskArn: task.taskArn, taskDefinitionArn: task.taskDefinitionArn, lastStatus: task.lastStatus,
    desiredStatus: task.desiredStatus, healthStatus: task.healthStatus, launchType: task.launchType,
    attachments: asArray(task.attachments).map((attachment) => ({
      type: attachment.type,
      details: asArray(attachment.details).filter(({ name }) => ["subnetId", "networkInterfaceId", "privateIPv4Address", "vpcId"].includes(name)),
    })),
  })));

  const imageReferences = new Map(DIGESTS.map((digest) => [
    `imageDigest=${digest}`,
    { imageId: `imageDigest=${digest}`, taskDefinitions: [] },
  ]));
  const imageTaskDefinitions = taskDefinitions.filter((task) =>
    [55, 56, 57].includes(task.revision) || task.taskDefinitionArn === service?.taskDefinition);
  for (const task of imageTaskDefinitions) {
    for (const container of task.containers) {
      const parsed = productionImageReference(container.image);
      if (!parsed) continue;
      const entry = imageReferences.get(parsed.imageId) ?? { ...parsed, taskDefinitions: [] };
      if (!entry.taskDefinitions.includes(task.taskDefinitionArn)) {
        entry.taskDefinitions.push(task.taskDefinitionArn);
      }
      imageReferences.set(parsed.imageId, entry);
    }
  }
  const imagePushWindows = [];
  for (const reference of imageReferences.values()) {
    const imageId = reference.imageId;
    const image = aws("ecr", "describe-images", ["--repository-name", ECR_REPOSITORY, "--image-ids", imageId], REGION, gaps);
    emit("ECR_IMAGE", asArray(image.imageDetails).map(({ repositoryName, imageDigest, imageTags, imagePushedAt, imageSizeInBytes, imageScanStatus, imageManifestMediaType }) =>
      ({ repositoryName, imageDigest, imageTags, imagePushedAt, imageSizeInBytes, imageScanStatus, imageManifestMediaType })));
    const imageDetails = asArray(image.imageDetails);
    for (const item of imageDetails) {
      emit("PRODUCTION_TASK_IMAGE_REFERENCE", {
        taskDefinitionArns: reference.taskDefinitions,
        imageDigest: item.imageDigest,
        imageTags: item.imageTags ?? [],
      });
      const manifest = aws("ecr", "batch-get-image", [
        "--repository-name", ECR_REPOSITORY,
        "--image-ids", `imageDigest=${item.imageDigest}`,
        "--accepted-media-types", "application/vnd.docker.distribution.manifest.v2+json",
      ], REGION, gaps);
      emit("ECR_IMAGE_MANIFEST", asArray(manifest.images).map((manifestItem) => {
        let details = {};
        try {
          const parsed = JSON.parse(manifestItem.imageManifest ?? "{}");
          details = {
            schemaVersion: parsed.schemaVersion,
            mediaType: parsed.mediaType,
            layerCount: asArray(parsed.layers).length,
            configDigest: parsed.config?.digest,
          };
        } catch {
          details = { parse: "FAILED" };
        }
        return { imageId: manifestItem.imageId, ...details };
      }));
      if (item.imagePushedAt) {
        const pushedAt = Date.parse(item.imagePushedAt);
        if (Number.isFinite(pushedAt)) {
          imagePushWindows.push({
            label: `IMAGE_PUSH_${item.imageDigest.slice(-12)}`,
            start: new Date(pushedAt - 10 * 60_000).toISOString(),
            end: new Date(pushedAt + 10 * 60_000).toISOString(),
            tags: item.imageTags ?? [],
          });
        }
      }
    }
  }
  const images = aws("ecr", "list-images", ["--repository-name", ECR_REPOSITORY, "--filter", "tagStatus=TAGGED", "--max-items", "100"], REGION, gaps);
  emit("ECR_TAGGED_IMAGE_COUNT", asArray(images.imageIds).length);

  for (const window of WINDOWS) cloudTrailWindow(window.label, window.start, window.end, gaps);
  cloudTrailWindow("REV55_PUSH", "2026-10-09T22:45:00Z", "2026-10-09T23:05:00Z", gaps);
  cloudTrailWindow("REV56_PUSH", "2026-10-09T23:15:00Z", "2026-10-09T23:35:00Z", gaps);
  const revisionsToInspect = new Set([
    57,
    Number(service?.taskDefinition?.split(":").at(-1)),
  ].filter(Number.isInteger));
  for (const revision of revisionsToInspect) {
    const task = taskDefinitions.find((item) => item.revision === revision);
    if (!task?.registeredAt) continue;
    const registeredAt = Date.parse(task.registeredAt);
    if (!Number.isFinite(registeredAt)) continue;
    cloudTrailWindow(
      revision === 57 ? "REV57" : `CURRENT_REVISION_${revision}`,
      new Date(registeredAt - 30 * 60_000).toISOString(),
      new Date(registeredAt + 30 * 60_000).toISOString(),
      gaps,
      [task.taskDefinitionArn],
    );
  }
  for (const window of imagePushWindows) {
    cloudTrailWindow(window.label, window.start, window.end, gaps, [], window.tags);
  }

  const stacks = aws("cloudformation", "describe-stacks", ["--stack-name", CLOUDFORMATION_STACK], REGION, gaps);
  const relevantStacks = asArray(stacks.Stacks).filter((stack) => stack.StackName === CLOUDFORMATION_STACK);
  for (const stack of relevantStacks) {
    emit("CLOUDFORMATION_STACK", {
      name: stack.StackName, status: stack.StackStatus, creationTime: stack.CreationTime,
      lastUpdatedTime: stack.LastUpdatedTime, roleARN: stack.RoleARN,
    });
    const resources = aws("cloudformation", "list-stack-resources", ["--stack-name", stack.StackName], REGION, gaps);
    emit("CLOUDFORMATION_RESOURCES", asArray(resources.StackResourceSummaries)
      .filter((resource) => /ecs|loadbalancer|targetgroup|rds|role/i.test(`${resource.ResourceType} ${resource.PhysicalResourceId}`))
      .map(({ LogicalResourceId, PhysicalResourceId, ResourceType, ResourceStatus, LastUpdatedTimestamp }) =>
        ({ LogicalResourceId, PhysicalResourceId, ResourceType, ResourceStatus, LastUpdatedTimestamp })));
    const changes = aws("cloudformation", "list-change-sets", ["--stack-name", stack.StackName], REGION, gaps);
    emit("CLOUDFORMATION_CHANGE_SETS", asArray(changes.Summaries).map(({ ChangeSetName, Status, ExecutionStatus, CreationTime }) =>
      ({ ChangeSetName, Status, ExecutionStatus, CreationTime })));
    for (const change of asArray(changes.Summaries)) {
      if (!change.ChangeSetName) continue;
      const detail = aws("cloudformation", "describe-change-set", ["--stack-name", stack.StackName, "--change-set-name", change.ChangeSetName], REGION, gaps);
      emit("CLOUDFORMATION_CHANGE_SET", {
        stackName: stack.StackName, changeSetName: detail.ChangeSetName, status: detail.Status,
        executionStatus: detail.ExecutionStatus, creationTime: detail.CreationTime,
        changes: asArray(detail.Changes).map(({ ResourceChange }) => ({
          action: ResourceChange?.Action, logicalId: ResourceChange?.LogicalResourceId,
          physicalId: ResourceChange?.PhysicalResourceId, resourceType: ResourceChange?.ResourceType,
        })),
      });
    }
    const events = aws("cloudformation", "describe-stack-events", ["--stack-name", stack.StackName, "--max-items", "100"], REGION, gaps);
    emit("CLOUDFORMATION_STACK_EVENTS", asArray(events.StackEvents)
      .filter((event) => event.Timestamp && Date.parse(event.Timestamp) >= Date.parse("2026-10-09T22:45:00Z"))
      .map(({ Timestamp, LogicalResourceId, PhysicalResourceId, ResourceType, ResourceStatus, ResourceStatusReason, ClientRequestToken }) =>
        ({ Timestamp, LogicalResourceId, PhysicalResourceId, ResourceType, ResourceStatus, ResourceStatusReason, ClientRequestToken })));
  }

  const rdsCalls = [
    ["describe-db-instances", "DB_INSTANCES"], ["describe-db-clusters", "DB_CLUSTERS"],
    ["describe-db-snapshots", "DB_SNAPSHOTS"], ["describe-db-cluster-snapshots", "DB_CLUSTER_SNAPSHOTS"],
    ["describe-db-subnet-groups", "DB_SUBNET_GROUPS"],
  ];
  const rdsInventory = {};
  for (const [operation, label] of rdsCalls) {
    const response = aws("rds", operation, ["--max-items", "100"], REGION, gaps);
    if (response.__accessDenied || response.__queryFailed) {
      rdsInventory[label] = response.__accessDenied ? "ACCESS_DENIED" : "QUERY_FAILED";
      continue;
    }
    const rows = {
      DB_INSTANCES: response.DBInstances,
      DB_CLUSTERS: response.DBClusters,
      DB_SNAPSHOTS: response.DBSnapshots,
      DB_CLUSTER_SNAPSHOTS: response.DBClusterSnapshots,
      DB_SUBNET_GROUPS: response.DBSubnetGroups,
    }[label] ?? [];
    rdsInventory[label] = asArray(rows).map(summarizeRdsResource);
  }
  emit("PRODUCTION_RDS_INVENTORY", rdsInventory);

  const vpcs = aws("ec2", "describe-vpcs", [], REGION, gaps);
  const subnets = aws("ec2", "describe-subnets", [], REGION, gaps);
  const routeTables = aws("ec2", "describe-route-tables", [], REGION, gaps);
  const groups = aws("ec2", "describe-security-groups", [], REGION, gaps);
  const networkInterfaces = aws("ec2", "describe-network-interfaces", [], REGION, gaps);
  emit("PRODUCTION_NETWORK_INVENTORY", {
    vpcs: asArray(vpcs.Vpcs).map(({ VpcId, CidrBlock, IsDefault, State }) => ({ VpcId, CidrBlock, IsDefault, State })),
    subnets: asArray(subnets.Subnets).map(({ SubnetId, VpcId, CidrBlock, AvailabilityZone, MapPublicIpOnLaunch }) =>
      ({ SubnetId, VpcId, CidrBlock, AvailabilityZone, MapPublicIpOnLaunch })),
    routeTables: asArray(routeTables.RouteTables).map(({ RouteTableId, VpcId, Routes, Associations }) =>
      ({ RouteTableId, VpcId, Routes, Associations })),
    securityGroups: asArray(groups.SecurityGroups).map(({ GroupId, GroupName, VpcId, IpPermissions, IpPermissionsEgress }) =>
      ({ GroupId, GroupName, VpcId, IpPermissions, IpPermissionsEgress })),
    networkInterfaces: asArray(networkInterfaces.NetworkInterfaces).map(({ NetworkInterfaceId, VpcId, SubnetId, Groups, PrivateIpAddress, Description }) =>
      ({ NetworkInterfaceId, VpcId, SubnetId, Groups, PrivateIpAddress, Description })),
  });
  const productionGroups = asArray(groups.SecurityGroups);
  const productionVpcIds = new Set(asArray(networkInterfaces.NetworkInterfaces)
    .filter((eni) => asArray(eni.Groups).some((group) =>
      (service?.networkConfiguration?.awsvpcConfiguration?.securityGroups ?? []).includes(group.GroupId)))
    .map((eni) => eni.VpcId));
  const taskGroupIds = service?.networkConfiguration?.awsvpcConfiguration?.securityGroups ?? [];
  const taskSubnets = asArray(subnets.Subnets).filter((subnet) =>
    (service?.networkConfiguration?.awsvpcConfiguration?.subnets ?? []).includes(subnet.SubnetId));
  const dbInstances = rdsInventory.DB_INSTANCES === "ACCESS_DENIED" ? [] : asArray(rdsInventory.DB_INSTANCES);
  const dbClusters = rdsInventory.DB_CLUSTERS === "ACCESS_DENIED" ? [] : asArray(rdsInventory.DB_CLUSTERS);
  const databaseRows = [...dbInstances, ...dbClusters];
  const connectivity = databaseRows.map((database) => {
    const dbGroups = database.securityGroups.map(({ id }) =>
      productionGroups.find((group) => group.GroupId === id)).filter(Boolean);
    const endpoint = database.endpoint ?? {};
    const port = endpoint.port ?? database.port ?? 5432;
    const taskGroupRecords = taskGroupIds.map((id) => productionGroups.find((group) => group.GroupId === id)).filter(Boolean);
    const egressAllowed = taskGroupRecords.some((group) => asArray(group.IpPermissionsEgress).some((rule) =>
      rule.IpProtocol === "-1" || (rule.IpProtocol === "tcp" && rule.FromPort <= port && rule.ToPort >= port)));
    const path = evaluateSecurityGroupPath({
      taskGroupIds,
      taskVpcId: [...productionVpcIds][0],
      taskSubnets: taskSubnets.map((subnet) => ({ subnetId: subnet.SubnetId, vpcId: subnet.VpcId })),
      dbSecurityGroups: dbGroups.map((group) => ({
        groupId: group.GroupId,
        ipPermissions: group.IpPermissions,
      })),
      dbVpcId: database.vpcId,
      dbPort: port,
    });
    return {
      database: database.identifier,
      endpoint: endpoint.address ?? null,
      port,
      taskSecurityGroups: taskGroupIds,
      dbSecurityGroups: dbGroups.map((group) => group.GroupId),
      taskEgressAllowsPort: egressAllowed,
      ...path,
    };
  });
  emit("PRODUCTION_ECS_TO_RDS_NETWORK", connectivity);

  const alarms = aws("cloudwatch", "describe-alarms", [
    "--alarm-types", "MetricAlarm", "CompositeAlarm", "--max-records", "100",
  ], REGION, gaps);
  emit("PRODUCTION_CLOUDWATCH_ALARMS", [
    ...summarizeAlarmInventory(alarms),
  ]);
  const logGroups = aws("logs", "describe-log-groups", ["--log-group-name-prefix", "/genesis/production"], REGION, gaps);
  emit("PRODUCTION_LOG_GROUPS", asArray(logGroups.logGroups).map(({ logGroupName, retentionInDays, storedBytes, kmsKeyId }) =>
    ({ logGroupName, retentionInDays, storedBytes, kmsKeyId })));
  for (const group of asArray(logGroups.logGroups)) {
    if (group.logGroupName !== WEB_LOG_GROUP) continue;
    const streams = aws("logs", "describe-log-streams", [
      "--log-group-name", group.logGroupName, "--order-by", "LastEventTime", "--descending", "--limit", "5",
    ], REGION, gaps);
    emit("PRODUCTION_LOG_STREAMS", {
      logGroupName: group.logGroupName,
      streams: asArray(streams.logStreams).map(({ logStreamName, lastEventTimestamp, storedBytes }) =>
        ({ logStreamName, lastEventTimestamp, storedBytes })),
    });
  }
  emit("READ_ONLY_PERMISSION_GAPS", [...gaps].sort());
}

if (process.argv[1]?.endsWith("production-inspection.mjs")) {
  inspect(new Set());
}
