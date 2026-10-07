import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { inspectStagingRuntime } from "../inspect-runtime.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const workflowPath = resolve(repoRoot, ".github/workflows/genesis-staging-bootstrap.yml");
const workflowText = await readFile(workflowPath, "utf8");

function fixture(overrides = {}) {
  const service = {
    serviceName: "genesis-staging-web",
    serviceArn: "arn:aws:ecs:us-west-2:452630323448:service/genesis-production/genesis-staging-web",
    status: "ACTIVE",
    desiredCount: 1,
    runningCount: 1,
    pendingCount: 0,
    taskDefinition: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-web:42",
    deployments: [{
      status: "PRIMARY",
      taskDefinition: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-web:42",
      desiredCount: 1,
      runningCount: 1,
      pendingCount: 0,
      rolloutState: "COMPLETED",
    }],
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: ["subnet-0f303dea5f645e42d", "subnet-00a0b287895a3b18c"],
        securityGroups: ["sg-0687242229bc3a80e"],
        assignPublicIp: "DISABLED",
      },
    },
    loadBalancers: [{
      targetGroupArn: "arn:aws:elasticloadbalancing:us-west-2:452630323448:targetgroup/genesis-staging-web/d729ca1a288ec4d1",
      containerName: "GenesisWebRuntime",
      containerPort: 3000,
    }],
    ...overrides.service,
  };
  const taskDefinition = {
    taskDefinitionArn: service.taskDefinition,
    family: "genesis-staging-web",
    requiresCompatibilities: ["FARGATE"],
    networkMode: "awsvpc",
    containerDefinitions: [{
      name: "GenesisWebRuntime",
      image: "452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-staging-runtime@sha256:example",
      portMappings: [{ containerPort: 3000, protocol: "tcp" }],
    }],
    ...overrides.taskDefinition,
  };
  const securityGroup = {
    GroupId: "sg-0687242229bc3a80e",
    GroupName: "genesis-staging-web-sg",
    VpcId: "vpc-05035503df7e142d6",
    Tags: [
      { Key: "Name", Value: "genesis-staging-web-sg" },
      { Key: "Environment", Value: "staging" },
    ],
    IpPermissions: [{
      IpProtocol: "tcp",
      FromPort: 3000,
      ToPort: 3000,
      UserIdGroupPairs: [{ GroupId: "sg-alb-staging" }],
    }],
    ...overrides.securityGroup,
  };
  const targetGroup = {
    TargetGroupArn: "arn:aws:elasticloadbalancing:us-west-2:452630323448:targetgroup/genesis-staging-web/d729ca1a288ec4d1",
    TargetType: "ip",
    Protocol: "HTTP",
    Port: 3000,
    HealthCheckProtocol: "HTTP",
    HealthCheckPort: "traffic-port",
    HealthCheckPath: "/api/health",
    Matcher: { HttpCode: "200" },
    LoadBalancerArns: ["arn:aws:elasticloadbalancing:us-west-2:452630323448:loadbalancer/app/staging/abc"],
    ...overrides.targetGroup,
  };
  const targets = overrides.targets ?? [{
    Target: { Id: "10.42.3.209", Port: 3000 },
    TargetHealth: { State: "healthy" },
  }];
  const responses = {
    "ecs:describe-services": { failures: [], services: [service] },
    "ecs:describe-task-definition": { taskDefinition },
    "ec2:describe-security-groups": { SecurityGroups: [securityGroup] },
    "elbv2:describe-target-groups": { TargetGroups: [targetGroup] },
    "elbv2:describe-load-balancers": { LoadBalancers: [{ SecurityGroups: ["sg-alb-staging"] }] },
    "elbv2:describe-target-health": { TargetHealthDescriptions: targets },
  };
  return {
    service,
    taskDefinition,
    securityGroup,
    targetGroup,
    targets,
    call: async (svc, operation) => responses[`${svc}:${operation}`],
  };
}

async function run(overrides) {
  const data = fixture(overrides);
  const output = [];
  const result = await inspectStagingRuntime({ call: data.call, report: (line) => output.push(line) });
  return { ...data, output, result };
}

async function rejects(overrides, message) {
  const data = fixture(overrides);
  await assert.rejects(
    inspectStagingRuntime({ call: data.call, report: () => {} }),
    message,
  );
}

test("workflow remains workflow_call-only and inserts live checks without removing existing gates", async () => {
  assert.match(workflowText, /^on:\s*\n\s+workflow_call:/m);
  assert.doesNotMatch(workflowText, /^\s+(push|pull_request|schedule|workflow_dispatch):/m);
  assert.match(workflowText, /- name: Inspect live staging runtime health[\s\S]*?node infra\/staging\/inspect-runtime\.mjs/);
  assert.match(workflowText, /CUSTOM_POLICY_SIMULATION=PASS/);
  assert.match(workflowText, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("healthy live ECS service passes all required service invariants", async () => {
  const { output } = await run();
  assert.ok(output.includes("STAGING_SERVICE_HEALTH=PASS"));
  assert.ok(output.includes("STAGING_SERVICE_STATUS=ACTIVE"));
  assert.ok(output.includes("STAGING_DESIRED_COUNT=1"));
  assert.ok(output.includes("STAGING_RUNNING_COUNT=1"));
  assert.ok(output.includes("STAGING_PENDING_COUNT=0"));
});

test("service must exist exactly once and be ACTIVE", async () => {
  await rejects({ service: { status: "INACTIVE" } }, /status is INACTIVE/);
  const data = fixture();
  data.call = async () => ({ failures: [], services: [data.service, data.service] });
  await assert.rejects(inspectStagingRuntime({ call: data.call, report: () => {} }), /exactly one/);
});

test("desired count must be at least one", async () => {
  await rejects({ service: { desiredCount: 0 } }, /desiredCount must be at least 1/);
});

test("running count must equal desired count", async () => {
  await rejects({ service: { runningCount: 0 } }, /runningCount does not match/);
});

test("pending count must be zero", async () => {
  await rejects({ service: { pendingCount: 1 } }, /pendingCount must be zero/);
});

test("service must have exactly one PRIMARY deployment", async () => {
  await rejects({ service: { deployments: [] } }, /exactly one PRIMARY/);
  await rejects({ service: { deployments: [
    ...fixture().service.deployments,
    { ...fixture().service.deployments[0] },
  ] } }, /exactly one PRIMARY/);
});

test("PRIMARY deployment must be completed and match service task definition", async () => {
  await rejects({ service: { deployments: [{ ...fixture().service.deployments[0], rolloutState: "IN_PROGRESS" }] } }, /rolloutState is not COMPLETED/);
  await rejects({ service: { deployments: [{ ...fixture().service.deployments[0], taskDefinition: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-web:41" }] } }, /differs from the service/);
});

test("dynamic task-definition revisions are accepted", async () => {
  const { output } = await run();
  assert.ok(output.includes("STAGING_TASK_DEFINITION_REVISION=42"));
});

test("task definition must be the expected Fargate awsvpc runtime family/container", async () => {
  await rejects({ taskDefinition: { family: "wrong-family" } }, /Unexpected task-definition family/);
  await rejects({ taskDefinition: { requiresCompatibilities: ["EC2"] } }, /not FARGATE compatible/);
  await rejects({ taskDefinition: { networkMode: "bridge" } }, /networkMode must be awsvpc/);
  await rejects({ taskDefinition: { containerDefinitions: [] } }, /exactly one staging runtime container/);
  await rejects({ taskDefinition: { containerDefinitions: [{ name: "WrongContainer", image: "image", portMappings: [] }] } }, /Expected container GenesisWebRuntime/);
});

test("staging runtime container must expose TCP/3000", async () => {
  await rejects({ taskDefinition: { containerDefinitions: [{
    name: "GenesisWebRuntime", image: "image", portMappings: [{ containerPort: 8080, protocol: "tcp" }],
  }] } }, /must expose TCP\/3000/);
  await rejects({ taskDefinition: { containerDefinitions: [{
    name: "GenesisWebRuntime", image: "image", portMappings: [{ containerPort: 3000, protocol: "udp" }],
  }] } }, /must expose TCP\/3000/);
});

test("service network is restricted to approved private subnets and no public IP", async () => {
  await rejects({ service: { networkConfiguration: { awsvpcConfiguration: {
    subnets: ["subnet-unapproved"], securityGroups: ["sg-0687242229bc3a80e"], assignPublicIp: "DISABLED",
  } } } }, /outside the approved private subnet set/);
  await rejects({ service: { networkConfiguration: { awsvpcConfiguration: {
    subnets: ["subnet-0f303dea5f645e42d"], securityGroups: ["sg-0687242229bc3a80e"], assignPublicIp: "ENABLED",
  } } } }, /must not assign public IP/);
});

test("production security group IDs are rejected", async () => {
  const data = fixture({ service: { networkConfiguration: { awsvpcConfiguration: {
    subnets: ["subnet-0f303dea5f645e42d"], securityGroups: ["sg-02f456f2dea97f1be"], assignPublicIp: "DISABLED",
  } } } });
  await assert.rejects(inspectStagingRuntime({ call: data.call, report: () => {} }), /Production security group/);
});

test("staging security group is accepted only with staging identity tags", async () => {
  const { output } = await run();
  assert.ok(output.includes("STAGING_NETWORK_CONFIGURATION=PASS"));
  assert.ok(output.includes("STAGING_SECURITY_GROUPS=sg-0687242229bc3a80e"));
  await rejects({ securityGroup: { Tags: [{ Key: "Environment", Value: "production" }] } }, /not identified as the staging web security group/);
});

test("staging security group must allow TCP/3000 from an ALB security group", async () => {
  await rejects({ securityGroup: { IpPermissions: [] } }, /lacks TCP\/3000 ingress/);
});

test("target group requires ip targets, HTTP protocol, and port 3000", async () => {
  await rejects({ targetGroup: { TargetType: "instance" } }, /target type must be ip/);
  await rejects({ targetGroup: { Protocol: "HTTPS" } }, /target protocol must be HTTP/);
  await rejects({ targetGroup: { Port: 80 } }, /target-group port must be 3000/);
});

test("target health check requires HTTP, /api/health, and a matcher including 200", async () => {
  await rejects({ targetGroup: { HealthCheckProtocol: "TCP" } }, /health-check protocol must be HTTP/);
  await rejects({ targetGroup: { HealthCheckPath: "/health" } }, /health-check path must be \/api\/health/);
  await rejects({ targetGroup: { Matcher: { HttpCode: "204" } } }, /matcher must include 200/);
  assert.equal((await run({ targetGroup: { Matcher: { HttpCode: "200-299" } } })).output.includes("STAGING_TARGET_HEALTH=PASS"), true);
});

test("at least one registered target is required and each must be healthy", async () => {
  await rejects({ targets: [] }, /no registered targets/);
  await rejects({ targets: [{
    Target: { Id: "10.42.3.209", Port: 3000 },
    TargetHealth: { State: "unhealthy", Reason: "Target.Timeout" },
  }] }, /unhealthy \(Target.Timeout\)/);
});

test("registered target port must align with the ECS and target-group TCP/3000 port", async () => {
  await rejects({ targets: [{
    Target: { Id: "10.42.3.209", Port: 80 },
    TargetHealth: { State: "healthy" },
  }] }, /not on port 3000/);
  const { output } = await run();
  assert.ok(output.includes("STAGING_PORT_ALIGNMENT=PASS"));
});

test("live ECS service must be attached to staging target group at runtime container port 3000", async () => {
  await rejects({ service: { loadBalancers: [] } }, /not attached to the staging target group/);
});

test("inspection invokes only read-only AWS APIs", async () => {
  const calls = [];
  const data = fixture();
  const call = async (service, operation, args) => {
    calls.push(`${service}:${operation}`);
    return data.call(service, operation, args);
  };
  await inspectStagingRuntime({ call, report: () => {} });
  assert.deepEqual(new Set(calls), new Set([
    "ecs:describe-services",
    "ecs:describe-task-definition",
    "ec2:describe-security-groups",
    "elbv2:describe-target-groups",
    "elbv2:describe-load-balancers",
    "elbv2:describe-target-health",
  ]));
  assert.doesNotMatch(await readFile(resolve(repoRoot, "infra/staging/inspect-runtime.mjs"), "utf8"), /\b(?:create|delete|modify|register|deregister|authorize|revoke|put|attach|detach)-[a-z-]+/i);
});

test("existing simulation and plan success gates remain ordered after live inspection", () => {
  const stepIndex = workflowText.indexOf("Inspect live staging runtime health");
  const planIndex = workflowText.indexOf("Run the read-only staging plan");
  assert.ok(stepIndex >= 0 && planIndex > stepIndex);
  assert.match(workflowText, /grep -Eq '\^CUSTOM_POLICY_SIMULATION=PASS/);
  assert.match(workflowText, /grep -Fqx 'GENESIS_STAGING_PLAN_GATE=PASS'/);
});
