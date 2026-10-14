import assert from "node:assert/strict";
import test from "node:test";
import {
  DEPLOYMENT_PREFLIGHT_CONSTANTS,
  evaluateProtectedServiceHealth,
  evaluateRecoverySafety,
  extractLauncherLambdaAsset,
  normalizeStackStatus,
  validateActivationState,
  validateCallerIdentity,
  validateStackIdentity,
  validateStackStateForMode,
  validateUpdateChangeSetScope,
  validateLauncherTemplateGuards,
} from "../s2g-db-admin-launcher/cdk/deployment-preflight-core.mjs";

function templateFixture(overrides = {}) {
  return {
    Parameters: {
      LauncherActivationState: {
        Default: "DISABLED",
        AllowedValues: ["DISABLED", "ENABLED"],
      },
      ApprovedDiagnosticTaskDefinitionArn: {
        Default: "",
      },
    },
    Resources: {
      DbAdminDiagnosticLauncherEnabledPolicy21B6A083: {
        Condition: "LauncherEnabledCondition",
      },
      StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C: {
        Condition: "LauncherEnabledCondition",
      },
      DbAdminDiagnosticLauncherFunction4A98B30B: {
        Properties: {
          Code: {
            S3Bucket: { "Fn::Sub": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}" },
            S3Key: "fff38d256e5c02f380e3a4a7233adf2e3eae1c2aed80319810c29133db596663.zip",
          },
        },
      },
    },
    ...overrides,
  };
}

function assetManifestFixture(key = "fff38d256e5c02f380e3a4a7233adf2e3eae1c2aed80319810c29133db596663.zip") {
  return {
    files: {
      one: {
        displayName: "DbAdminDiagnosticLauncherFunction/Code",
        source: { path: "asset.fff38d256e5c02f380e3a4a7233adf2e3eae1c2aed80319810c29133db596663" },
        destinations: {
          current: {
            bucketName: "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}",
            objectKey: key,
          },
        },
      },
    },
  };
}

test("template guard validation enforces disabled activation and conditional policies", () => {
  assert.doesNotThrow(() => validateLauncherTemplateGuards(templateFixture()));
  assert.throws(
    () => validateLauncherTemplateGuards(templateFixture({
      Parameters: {
        LauncherActivationState: { Default: "ENABLED", AllowedValues: ["DISABLED", "ENABLED"] },
        ApprovedDiagnosticTaskDefinitionArn: { Default: "" },
      },
      Resources: templateFixture().Resources,
    })),
    /DEPLOYMENT_PREFLIGHT_ACTIVATION_NOT_DISABLED/,
  );
  assert.throws(
    () => validateLauncherTemplateGuards(templateFixture({
      Resources: {
        ...templateFixture().Resources,
        DbAdminDiagnosticLauncherEnabledPolicy21B6A083: {},
      },
    })),
    /DEPLOYMENT_PREFLIGHT_ENABLED_POLICY_UNGUARDED/,
  );
});

test("asset extraction validates manifest/template key consistency", () => {
  const result = extractLauncherLambdaAsset({
    template: templateFixture(),
    assetManifest: assetManifestFixture(),
  });
  assert.equal(
    result.templateKey,
    "fff38d256e5c02f380e3a4a7233adf2e3eae1c2aed80319810c29133db596663.zip",
  );
  assert.throws(
    () => extractLauncherLambdaAsset({
      template: templateFixture(),
      assetManifest: assetManifestFixture("other.zip"),
    }),
    /DEPLOYMENT_PREFLIGHT_ASSET_KEY_MISMATCH/,
  );
});

test("recovery safety rejects rollback and retained table conflicts unless explicitly acknowledged", () => {
  assert.throws(
    () => evaluateRecoverySafety({
      stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      stackStatus: "ROLLBACK_COMPLETE",
      retainedTableExists: false,
      allowRollbackComplete: false,
    }),
    /DEPLOYMENT_PREFLIGHT_ROLLBACK_REQUIRES_REVIEW/,
  );
  assert.throws(
    () => evaluateRecoverySafety({
      stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      stackStatus: "STACK_ABSENT",
      retainedTableExists: true,
      allowRollbackComplete: true,
    }),
    /DEPLOYMENT_PREFLIGHT_RETAINED_TABLE_CONFLICT/,
  );
  assert.doesNotThrow(() => evaluateRecoverySafety({
    stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    stackStatus: "STACK_ABSENT",
    retainedTableExists: false,
    allowRollbackComplete: true,
  }));
});

test("mode-specific stack state checks enforce create and update expectations", () => {
  assert.throws(
    () => validateStackStateForMode({
      stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      stackStatus: "CREATE_COMPLETE",
      retainedTableExists: true,
      mode: "create",
    }),
    /DEPLOYMENT_PREFLIGHT_STACK_ALREADY_EXISTS/,
  );
  assert.doesNotThrow(() => validateStackStateForMode({
    stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    stackStatus: "CREATE_COMPLETE",
    retainedTableExists: true,
    mode: "update",
  }));
  assert.throws(
    () => validateStackStateForMode({
      stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      stackStatus: "CREATE_COMPLETE",
      retainedTableExists: false,
      mode: "update",
    }),
    /DEPLOYMENT_PREFLIGHT_TABLE_MISSING_FOR_UPDATE/,
  );
});

test("stack identity validation checks stack name and stack id format", () => {
  assert.doesNotThrow(() => validateStackIdentity({
    StackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    StackId: `arn:aws:cloudformation:us-west-2:452630323448:stack/${DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME}/abc`,
  }, DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME));
  assert.throws(
    () => validateStackIdentity({
      StackName: "OtherStack",
      StackId: "arn:aws:cloudformation:us-west-2:452630323448:stack/OtherStack/abc",
    }, DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME),
    /DEPLOYMENT_PREFLIGHT_STACK_NAME_MISMATCH/,
  );
});

test("update change-set scope validation rejects non-modify and replacement actions", () => {
  const base = {
    StackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    Status: "CREATE_COMPLETE",
    ExecutionStatus: "AVAILABLE",
    Changes: [
      {
        ResourceChange: {
          Action: "Modify",
          LogicalResourceId: "DbAdminDiagnosticLauncherFunction4A98B30B",
          Replacement: "False",
        },
      },
    ],
  };
  assert.doesNotThrow(() => validateUpdateChangeSetScope(base, {
    expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    allowedLogicalIds: ["DbAdminDiagnosticLauncherFunction4A98B30B"],
  }));
  assert.throws(
    () => validateUpdateChangeSetScope({
      ...base,
      Changes: [{ ResourceChange: { Action: "Add", LogicalResourceId: "X", Replacement: "False" } }],
    }, {
      expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      allowedLogicalIds: ["DbAdminDiagnosticLauncherFunction4A98B30B"],
    }),
    /DEPLOYMENT_PREFLIGHT_CHANGE_SET_UNEXPECTED_ACTION/,
  );
});

test("activation state validation enforces expected launcher mode and task arn", () => {
  assert.doesNotThrow(() => validateActivationState({
    launcherActivationState: "DISABLED",
    approvedDiagnosticTaskDefinitionArn: "",
    expectedActivationState: "DISABLED",
    expectedApprovedTaskArn: "",
  }));
  assert.throws(
    () => validateActivationState({
      launcherActivationState: "ENABLED",
      approvedDiagnosticTaskDefinitionArn: "",
      expectedActivationState: "DISABLED",
      expectedApprovedTaskArn: "",
    }),
    /DEPLOYMENT_PREFLIGHT_ACTIVATION_STATE_MISMATCH/,
  );
});

test("protected service health validation requires active completed deployments", () => {
  const services = DEPLOYMENT_PREFLIGHT_CONSTANTS.PROTECTED_ECS_SERVICES.map((serviceName) => ({
    serviceName,
    status: "ACTIVE",
    desiredCount: 1,
    runningCount: 1,
    pendingCount: 0,
    deployments: [{ rolloutState: "COMPLETED" }],
  }));
  assert.doesNotThrow(() => evaluateProtectedServiceHealth(services));
  assert.throws(
    () => evaluateProtectedServiceHealth([
      ...services.filter((service) => service.serviceName !== "genesis-staging-web"),
    ]),
    /DEPLOYMENT_PREFLIGHT_PROTECTED_SERVICE_MISSING/,
  );
});

test("caller identity validation requires expected account and assumed role ARN", () => {
  assert.doesNotThrow(() => validateCallerIdentity({
    Account: "452630323448",
    Arn: "arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f/Robert",
  }, "452630323448"));
  assert.throws(
    () => validateCallerIdentity({ Account: "111111111111", Arn: "arn:aws:sts::111111111111:assumed-role/test/x" }, "452630323448"),
    /DEPLOYMENT_PREFLIGHT_ACCOUNT_MISMATCH/,
  );
  assert.throws(
    () => validateCallerIdentity({ Account: "452630323448", Arn: "arn:aws:iam::452630323448:root" }, "452630323448"),
    /DEPLOYMENT_PREFLIGHT_NON_ASSUMED_ROLE/,
  );
});

test("stack status normalization handles missing stack state", () => {
  assert.equal(normalizeStackStatus(null), "STACK_ABSENT");
  assert.equal(normalizeStackStatus("ROLLBACK_COMPLETE"), "ROLLBACK_COMPLETE");
});
