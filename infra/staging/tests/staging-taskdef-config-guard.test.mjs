import assert from "node:assert/strict";
import test from "node:test";
import { buildCandidateFromBaseline, assertMatchesPreservedConfiguration } from "../staging-taskdef-config-guard.mjs";

function baselineTaskDefinition() {
  return {
    taskDefinitionArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-web:10",
    revision: 10,
    status: "ACTIVE",
    family: "genesis-staging-web",
    taskRoleArn: "arn:aws:iam::452630323448:role/genesis-staging-task-role",
    executionRoleArn: "arn:aws:iam::452630323448:role/genesis-staging-execution-role",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    cpu: "512",
    memory: "1024",
    runtimePlatform: { cpuArchitecture: "X86_64", operatingSystemFamily: "LINUX" },
    volumes: [
      {
        name: "genesis-persistence",
        efsVolumeConfiguration: {
          fileSystemId: "fs-12345678",
          transitEncryption: "ENABLED",
          authorizationConfig: { accessPointId: "fsap-12345678", iam: "DISABLED" },
        },
      },
    ],
    containerDefinitions: [
      {
        name: "GenesisWebRuntime",
        image: "452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-staging-runtime@sha256:old",
        essential: true,
        command: ["npm", "run", "start"],
        portMappings: [{ containerPort: 3000, protocol: "tcp" }],
        mountPoints: [
          { sourceVolume: "genesis-persistence", containerPath: "/mnt/genesis-persistence", readOnly: false },
        ],
        environment: [
          { name: "NODE_ENV", value: "production" },
          { name: "GENESIS_ENVIRONMENT", value: "staging" },
          { name: "GENESIS_STONER_GYM_RECRUITED_CREATORS", value: "jessica" },
          { name: "GCP_FOUNDATION_PERSISTENCE_DIR", value: "/mnt/genesis-persistence/foundation" },
          { name: "GLW_N8N_RECONNECT_ENABLED", value: "false" },
          { name: "GLW_N8N_NON_MUTATING_TEST", value: "true" },
          { name: "GIT_COMMIT", value: "64481d9320850312b3fc021eba425055c2e4c567" },
          { name: "GENESIS_RUNTIME_SHA", value: "64481d9320850312b3fc021eba425055c2e4c567" },
        ],
        secrets: [
          {
            name: "GENESIS_WOOCOMMERCE_WEBHOOK_SECRET",
            valueFrom: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/woocommerce-webhook-secret-abc",
          },
          {
            name: "GLW_N8N_CALLBACK_SECRET",
            valueFrom: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/glw-n8n-callback-secret-xyz",
          },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": "/genesis/staging/web",
            "awslogs-region": "us-west-2",
            "awslogs-stream-prefix": "web",
          },
        },
        healthCheck: {
          command: ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
          interval: 30,
          timeout: 5,
          retries: 3,
          startPeriod: 10,
        },
      },
    ],
  };
}

test("buildCandidateFromBaseline preserves all non-image config and updates only approved fields", () => {
  const baseline = baselineTaskDefinition();
  const image = "452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-staging-runtime@sha256:new";
  const gitCommit = "05524dab00e82af28260e8082edf70a683d4266e";

  const candidate = buildCandidateFromBaseline({ baselineTaskDefinition: baseline, imageUriWithDigest: image, gitCommit });
  const container = candidate.containerDefinitions[0];

  assert.equal(container.image, image);
  assert.equal(container.environment.find((entry) => entry.name === "GIT_COMMIT")?.value, gitCommit);
  assert.equal(container.environment.find((entry) => entry.name === "GENESIS_RUNTIME_SHA")?.value, gitCommit);
  assert.equal(container.environment.find((entry) => entry.name === "GLW_N8N_RECONNECT_ENABLED")?.value, "false");
  assert.equal(container.environment.find((entry) => entry.name === "GLW_N8N_NON_MUTATING_TEST")?.value, "true");
  assert.equal(container.secrets.find((entry) => entry.name === "GLW_N8N_CALLBACK_SECRET")?.valueFrom,
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/glw-n8n-callback-secret-xyz");
  assert.deepEqual(candidate.volumes, baseline.volumes);
  assert.equal(candidate.taskRoleArn, baseline.taskRoleArn);
  assert.equal(candidate.executionRoleArn, baseline.executionRoleArn);
  assert.ok(!("taskDefinitionArn" in candidate));
  assert.ok(!("revision" in candidate));
});

test("assertMatchesPreservedConfiguration fails when non-approved fields drift", () => {
  const baseline = baselineTaskDefinition();
  const image = "452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-staging-runtime@sha256:new";
  const gitCommit = "05524dab00e82af28260e8082edf70a683d4266e";
  const candidate = buildCandidateFromBaseline({ baselineTaskDefinition: baseline, imageUriWithDigest: image, gitCommit });
  candidate.containerDefinitions[0].secrets = candidate.containerDefinitions[0].secrets.filter((item) => item.name !== "GLW_N8N_CALLBACK_SECRET");

  assert.throws(() => {
    assertMatchesPreservedConfiguration({
      baselineTaskDefinition: baseline,
      candidateTaskDefinition: candidate,
      imageUriWithDigest: image,
      gitCommit,
    });
  }, /drifted from approved staging baseline/i);
});
