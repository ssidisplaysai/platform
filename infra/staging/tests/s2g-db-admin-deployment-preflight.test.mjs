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
  validatePackagingOnlyAssetEvidence,
  validatePackagingOnlyChangeSetScope,
  validateStackIdentity,
  validateStackStateForMode,
  validateUpdateChangeSetParameters,
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
  assert.doesNotThrow(() => validateStackStateForMode({
    stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    stackStatus: "UPDATE_COMPLETE",
    retainedTableExists: true,
    mode: "update",
  }));
  assert.doesNotThrow(() => validateStackStateForMode({
    stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    stackStatus: "UPDATE_COMPLETE",
    retainedTableExists: true,
    mode: "update-packaging",
  }));
  assert.throws(
    () => validateStackStateForMode({
      stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      stackStatus: "UPDATE_ROLLBACK_COMPLETE",
      retainedTableExists: true,
      mode: "update",
      allowRollbackComplete: false,
    }),
    /DEPLOYMENT_PREFLIGHT_UPDATE_ROLLBACK_REQUIRES_REVIEW/,
  );
  assert.doesNotThrow(() => validateStackStateForMode({
    stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    stackStatus: "UPDATE_ROLLBACK_COMPLETE",
    retainedTableExists: true,
    mode: "update",
    allowRollbackComplete: true,
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
  assert.throws(
    () => validateStackStateForMode({
      stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      stackStatus: "UPDATE_IN_PROGRESS",
      retainedTableExists: true,
      mode: "update",
    }),
    /DEPLOYMENT_PREFLIGHT_STACK_UPDATE_IN_PROGRESS/,
  );
  assert.throws(
    () => validateStackStateForMode({
      stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      stackStatus: "UPDATE_FAILED",
      retainedTableExists: true,
      mode: "update",
    }),
    /DEPLOYMENT_PREFLIGHT_STACK_UPDATE_FAILED/,
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

test("update change-set scope validation enforces exact approved action inventory", () => {
  const base = {
    StackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    ChangeSetType: "UPDATE",
    Status: "CREATE_COMPLETE",
    ExecutionStatus: "AVAILABLE",
    Changes: [
      {
        ResourceChange: {
          Action: "Add",
          LogicalResourceId: "DbAdminDiagnosticLauncherEnabledPolicy21B6A083",
        },
      },
      {
        ResourceChange: {
          Action: "Modify",
          LogicalResourceId: "DbAdminDiagnosticLauncherFunction4A98B30B",
          Replacement: "False",
        },
      },
      {
        ResourceChange: {
          Action: "Modify",
          LogicalResourceId: "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4",
          Replacement: "Conditional",
        },
      },
      {
        ResourceChange: {
          Action: "Add",
          LogicalResourceId: "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
        },
      },
    ],
  };
  assert.doesNotThrow(() => validateUpdateChangeSetScope(base, {
    expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    allowedLogicalIds: [
      "DbAdminDiagnosticLauncherEnabledPolicy21B6A083",
      "DbAdminDiagnosticLauncherFunction4A98B30B",
      "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4",
      "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
    ],
    expectedResourceChanges: [
      { logicalResourceId: "DbAdminDiagnosticLauncherEnabledPolicy21B6A083", action: "Add" },
      { logicalResourceId: "DbAdminDiagnosticLauncherFunction4A98B30B", action: "Modify", replacement: "False" },
      { logicalResourceId: "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4", action: "Modify", replacement: "Conditional" },
      { logicalResourceId: "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C", action: "Add" },
    ],
  }));
  assert.doesNotThrow(() => validateUpdateChangeSetScope({
    ...base,
    ChangeSetType: null,
  }, {
    expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    allowedLogicalIds: [
      "DbAdminDiagnosticLauncherEnabledPolicy21B6A083",
      "DbAdminDiagnosticLauncherFunction4A98B30B",
      "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4",
      "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
    ],
    expectedResourceChanges: [
      { logicalResourceId: "DbAdminDiagnosticLauncherEnabledPolicy21B6A083", action: "Add" },
      { logicalResourceId: "DbAdminDiagnosticLauncherFunction4A98B30B", action: "Modify", replacement: "False" },
      { logicalResourceId: "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4", action: "Modify", replacement: "Conditional" },
      { logicalResourceId: "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C", action: "Add" },
    ],
  }));
  assert.throws(
    () => validateUpdateChangeSetScope({
      ...base,
      ChangeSetType: "CREATE",
    }, {
      expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      allowedLogicalIds: [
        "DbAdminDiagnosticLauncherEnabledPolicy21B6A083",
        "DbAdminDiagnosticLauncherFunction4A98B30B",
        "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4",
        "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
      ],
      expectedResourceChanges: [
        { logicalResourceId: "DbAdminDiagnosticLauncherEnabledPolicy21B6A083", action: "Add" },
        { logicalResourceId: "DbAdminDiagnosticLauncherFunction4A98B30B", action: "Modify", replacement: "False" },
        { logicalResourceId: "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4", action: "Modify", replacement: "Conditional" },
        { logicalResourceId: "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C", action: "Add" },
      ],
    }),
    /DEPLOYMENT_PREFLIGHT_CHANGE_SET_NOT_UPDATE/,
  );
  assert.throws(
    () => validateUpdateChangeSetScope({
      ...base,
      Changes: [
        ...base.Changes.slice(0, 3),
        {
          ResourceChange: {
            Action: "Modify",
            LogicalResourceId: "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
          },
        },
      ],
    }, {
      expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
      allowedLogicalIds: [
        "DbAdminDiagnosticLauncherEnabledPolicy21B6A083",
        "DbAdminDiagnosticLauncherFunction4A98B30B",
        "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4",
        "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
      ],
      expectedResourceChanges: [
        { logicalResourceId: "DbAdminDiagnosticLauncherEnabledPolicy21B6A083", action: "Add" },
        { logicalResourceId: "DbAdminDiagnosticLauncherFunction4A98B30B", action: "Modify", replacement: "False" },
        { logicalResourceId: "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4", action: "Modify", replacement: "Conditional" },
        { logicalResourceId: "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C", action: "Add" },
      ],
    }),
    /DEPLOYMENT_PREFLIGHT_CHANGE_SET_UNEXPECTED_ACTION/,
  );
});

test("update change-set parameter validation enforces exact arn, enabled activation, and unchanged bindings", () => {
  const deployedStackParameters = [
    { ParameterKey: "LauncherActivationState", ParameterValue: "DISABLED" },
    { ParameterKey: "OperatorAssumerPrincipalArn", ParameterValue: "arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49" },
    { ParameterKey: "ApprovedDiagnosticTaskDefinitionArn", ParameterValue: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:1" },
    { ParameterKey: "ApprovedDiagnosticImageDigest", ParameterValue: "sha256:4603f32f34be3dcf4c4c80fee1c521d2427fc95b54d6e031fb0fa868143be7b5" },
    { ParameterKey: "StagingClusterArn", ParameterValue: "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production" },
    { ParameterKey: "StagingSubnets", ParameterValue: "subnet-0f303dea5f645e42d,subnet-00a0b287895a3b18c" },
    { ParameterKey: "StagingSecurityGroups", ParameterValue: "sg-0e9dcd277642bdb63" },
    { ParameterKey: "ExpectedDatabaseHost", ParameterValue: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com" },
    { ParameterKey: "ExpectedDatabaseName", ParameterValue: "genesis_staging" },
    { ParameterKey: "DiagnosticExecutionRoleArn", ParameterValue: "arn:aws:iam::452630323448:role/genesis-staging-s2g-db-role-provision-execution-role" },
    { ParameterKey: "DiagnosticTaskRoleArn", ParameterValue: "arn:aws:iam::452630323448:role/genesis-staging-s2g-db-role-provision-task-role" },
  ];
  const changeSetArn = "arn:aws:cloudformation:us-west-2:452630323448:changeSet/s2g-db-launcher-enable-second-diag-20261014T220618Z/6c07fc77-634e-41e0-8cc5-3dce7d695d5b";
  const changeSetParameters = [
    { ParameterKey: "LauncherActivationState", ParameterValue: "ENABLED" },
    ...deployedStackParameters.filter(({ ParameterKey }) => ParameterKey !== "LauncherActivationState"),
  ];
  assert.doesNotThrow(() => validateUpdateChangeSetParameters({
    expectedChangeSetArn: changeSetArn,
    changeSetArn,
    changeSetParameters,
    deployedStackParameters,
    expectedOperatorAssumerPrincipalArn: "arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49",
  }));
  assert.throws(
    () => validateUpdateChangeSetParameters({
      expectedChangeSetArn: changeSetArn,
      changeSetArn: "arn:aws:cloudformation:us-west-2:452630323448:changeSet/other/1234",
      changeSetParameters,
      deployedStackParameters,
      expectedOperatorAssumerPrincipalArn: "arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49",
    }),
    /DEPLOYMENT_PREFLIGHT_CHANGE_SET_ARN_MISMATCH/,
  );
  assert.throws(
    () => validateUpdateChangeSetParameters({
      expectedChangeSetArn: changeSetArn,
      changeSetArn,
      changeSetParameters: [
        { ParameterKey: "LauncherActivationState", ParameterValue: "DISABLED" },
        ...deployedStackParameters.filter(({ ParameterKey }) => ParameterKey !== "LauncherActivationState"),
      ],
      deployedStackParameters,
      expectedOperatorAssumerPrincipalArn: "arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49",
    }),
    /DEPLOYMENT_PREFLIGHT_CHANGE_SET_ACTIVATION_NOT_ENABLED/,
  );
  assert.doesNotThrow(() => validateUpdateChangeSetParameters({
    expectedChangeSetArn: changeSetArn,
    changeSetArn,
    changeSetParameters: [
      { ParameterKey: "LauncherActivationState", ParameterValue: "DISABLED" },
      ...deployedStackParameters.filter(({ ParameterKey }) => ParameterKey !== "LauncherActivationState"),
    ],
    deployedStackParameters,
    expectedOperatorAssumerPrincipalArn: "arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49",
    expectedProposedActivationState: "DISABLED",
  }));
  assert.throws(
    () => validateUpdateChangeSetParameters({
      expectedChangeSetArn: changeSetArn,
      changeSetArn,
      changeSetParameters,
      deployedStackParameters,
      expectedOperatorAssumerPrincipalArn: "arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49",
      expectedProposedActivationState: "DISABLED",
    }),
    /DEPLOYMENT_PREFLIGHT_CHANGE_SET_ACTIVATION_STATE_UNEXPECTED/,
  );
});

test("packaging-only change-set scope accepts code-only update and rejects unsupported changes", () => {
  const base = {
    StackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    ChangeSetType: "UPDATE",
    Status: "CREATE_COMPLETE",
    ExecutionStatus: "AVAILABLE",
    Changes: [
      {
        ResourceChange: {
          Action: "Modify",
          LogicalResourceId: "DbAdminDiagnosticLauncherFunction4A98B30B",
          Replacement: "False",
          Details: [{
            Target: {
              Attribute: "Properties",
              Name: "Code",
              RequiresRecreation: "Never",
            },
            Evaluation: "Static",
            ChangeSource: "DirectModification",
          }],
        },
      },
      {
        ResourceChange: {
          Action: "Modify",
          LogicalResourceId: "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4",
          Replacement: "Conditional",
          Details: [{
            Target: {
              Attribute: "Properties",
              Name: "TargetFunctionArn",
              RequiresRecreation: "Always",
            },
            Evaluation: "Dynamic",
            ChangeSource: "ResourceAttribute",
            CausingEntity: "DbAdminDiagnosticLauncherFunction4A98B30B.Arn",
          }],
        },
      },
    ],
  };

  assert.doesNotThrow(() => validatePackagingOnlyChangeSetScope(base, {
    expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
  }));
  assert.doesNotThrow(() => validatePackagingOnlyChangeSetScope({
    ...base,
    Changes: [base.Changes[0]],
  }, {
    expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
  }));
  assert.throws(
    () => validatePackagingOnlyChangeSetScope({
      ...base,
      Changes: [
        ...base.Changes,
        {
          ResourceChange: {
            Action: "Modify",
            LogicalResourceId: "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
            Replacement: "False",
          },
        },
      ],
    }, {
      expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_SCOPE_UNEXPECTED_ACTION_COUNT/,
  );
  assert.throws(
    () => validatePackagingOnlyChangeSetScope({
      ...base,
      Changes: [{
        ResourceChange: {
          ...base.Changes[0].ResourceChange,
          Details: [{
            Target: {
              Attribute: "Properties",
              Name: "Environment",
              RequiresRecreation: "Never",
            },
            Evaluation: "Static",
            ChangeSource: "DirectModification",
          }],
        },
      }],
    }, {
      expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_SCOPE_LAMBDA_NON_CODE_CHANGE/,
  );
  assert.throws(
    () => validatePackagingOnlyChangeSetScope({
      ...base,
      Changes: [{
        ResourceChange: {
          ...base.Changes[1].ResourceChange,
          Details: [{
            ...base.Changes[1].ResourceChange.Details[0],
            Target: {
              ...base.Changes[1].ResourceChange.Details[0].Target,
              Name: "AuthType",
            },
          }],
        },
      }, base.Changes[0]],
    }, {
      expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_SCOPE_URL_NON_DEPENDENCY_CHANGE/,
  );
  assert.throws(
    () => validatePackagingOnlyChangeSetScope({
      ...base,
      Changes: [{
        ResourceChange: {
          ...base.Changes[1].ResourceChange,
          Replacement: "True",
        },
      }, base.Changes[0]],
    }, {
      expectedStackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_SCOPE_URL_REPLACEMENT_UNSUPPORTED/,
  );
});

test("packaging-only asset evidence enforces required modules and digests", () => {
  const base = {
    packageFiles: [
      "diagnostic-launcher-lambda.mjs",
      "diagnostic-launcher-core.mjs",
      "s2g-db-admin-diagnostic-contract.mjs",
    ],
    requiredFiles: [
      "diagnostic-launcher-lambda.mjs",
      "diagnostic-launcher-core.mjs",
      "s2g-db-admin-diagnostic-contract.mjs",
    ],
    missingLocalImports: [],
    absoluteImports: [],
    handlerImportStatus: "ok",
    zipSha256Hex: "a14d3b9682716355aa9b748ada5a7a171985a0f497650dc37806b03f1da93fdb",
    expectedZipSha256Hex: "a14d3b9682716355aa9b748ada5a7a171985a0f497650dc37806b03f1da93fdb",
    proposedCodeSha256: "oU07loJxY1Wqm3SK2lp6FxmFoPSXZQ3DeAawPx2pP9s=",
    expectedCodeSha256: "oU07loJxY1Wqm3SK2lp6FxmFoPSXZQ3DeAawPx2pP9s=",
  };
  assert.doesNotThrow(() => validatePackagingOnlyAssetEvidence(base));
  assert.throws(
    () => validatePackagingOnlyAssetEvidence({
      ...base,
      packageFiles: [
        "diagnostic-launcher-lambda.mjs",
        "diagnostic-launcher-core.mjs",
      ],
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_MODULE_MISSING/,
  );
  assert.throws(
    () => validatePackagingOnlyAssetEvidence({
      ...base,
      zipSha256Hex: "deadbeef",
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_ZIP_DIGEST_MISMATCH/,
  );
  assert.throws(
    () => validatePackagingOnlyAssetEvidence({
      ...base,
      proposedCodeSha256: "wrong",
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_CODE_SHA_MISMATCH/,
  );
  assert.throws(
    () => validatePackagingOnlyAssetEvidence({
      ...base,
      absoluteImports: [{ file: "diagnostic-launcher-core.mjs", specifier: "/tmp/evil.mjs" }],
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_ABSOLUTE_IMPORT_DETECTED/,
  );
  assert.throws(
    () => validatePackagingOnlyAssetEvidence({
      ...base,
      handlerImportStatus: "error:ERR_MODULE_NOT_FOUND",
    }),
    /DEPLOYMENT_PREFLIGHT_PACKAGING_HANDLER_IMPORT_FAILED/,
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
