import cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";

const ADMIN_SSO_ROLE_ARN = "arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_AdministratorAccess_0eb5f574d17f421f";

export function createStagingS2gDbAdminAuthorizationIdentityStack(
  app,
  id = "GenesisStagingS2gDbAdminAuthorizationIdentityStack",
  props = {},
) {
  const stack = new cdk.Stack(app, id, props);

  const restrictedCreatorSourcePrincipalArn = new cdk.CfnParameter(stack, "RestrictedCreatorSourcePrincipalArn", {
    type: "String",
    allowedPattern: "^arn:aws:iam::452630323448:role/[A-Za-z0-9+=,.@_\\/-]{1,128}$",
    description: "Existing restricted same-account IAM role ARN that may assume the authorization-writer role.",
  });
  const diagnosticAuthorizationTableArn = new cdk.CfnParameter(stack, "DiagnosticAuthorizationTableArn", {
    type: "String",
    default: "arn:aws:dynamodb:us-west-2:452630323448:table/genesis-staging-s2g-db-admin-diagnostic-launches",
    allowedPattern: "^arn:aws:dynamodb:us-west-2:452630323448:table/genesis-staging-s2g-db-admin-diagnostic-launches$",
    description: "Exact staging diagnostic launch authorization table ARN.",
  });

  new cdk.CfnRule(stack, "RestrictedCreatorSourcePrincipalMustNotBeAdministratorAccessRole", {
    assertions: [{
      assert: cdk.Fn.conditionNot(cdk.Fn.conditionEquals(
        restrictedCreatorSourcePrincipalArn.valueAsString,
        ADMIN_SSO_ROLE_ARN,
      )),
      assertDescription: "RestrictedCreatorSourcePrincipalArn must not be the AWSReservedSSO AdministratorAccess role.",
    }],
  });

  const authorizationWriterRole = new iam.Role(stack, "StagingS2gDbAdminAuthorizationWriterRole", {
    roleName: "genesis-staging-s2g-db-admin-authorization-writer-role",
    assumedBy: new iam.ArnPrincipal(restrictedCreatorSourcePrincipalArn.valueAsString),
    description: "Writes exactly one staging DB diagnostic authorization record per approved run.",
  });
  authorizationWriterRole.addToPolicy(new iam.PolicyStatement({
    sid: "CreateDiagnosticLaunchAuthorizationOnly",
    effect: iam.Effect.ALLOW,
    actions: ["dynamodb:PutItem"],
    resources: [diagnosticAuthorizationTableArn.valueAsString],
    conditions: {
      "ForAllValues:StringLike": {
        "dynamodb:LeadingKeys": ["s2g-dbdiag-*"],
      },
      "Null": {
        "dynamodb:LeadingKeys": "false",
      },
    },
  }));

  new cdk.CfnOutput(stack, "AuthorizationWriterRoleArn", {
    value: authorizationWriterRole.roleArn,
    description: "Assumable writer role for single-use diagnostic authorization records.",
  });
  new cdk.CfnOutput(stack, "RestrictedCreatorSourcePrincipalArnOutput", {
    value: restrictedCreatorSourcePrincipalArn.valueAsString,
    description: "Restricted source principal trusted to assume AuthorizationWriterRoleArn.",
  });
  new cdk.CfnOutput(stack, "DiagnosticAuthorizationTableArnOutput", {
    value: diagnosticAuthorizationTableArn.valueAsString,
    description: "Exact table ARN writable by the authorization-writer role.",
  });

  return stack;
}
