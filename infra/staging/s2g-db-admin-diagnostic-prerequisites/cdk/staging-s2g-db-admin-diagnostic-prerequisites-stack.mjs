import cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";

export function createStagingS2gDbAdminDiagnosticPrerequisitesStack(
  app,
  id = "GenesisStagingS2gDbAdminDiagnosticPrerequisitesStack",
  props = {},
) {
  const stack = new cdk.Stack(app, id, props);

  const vpcId = new cdk.CfnParameter(stack, "StagingVpcId", {
    type: "AWS::EC2::VPC::Id",
    default: "vpc-05035503df7e142d6",
    description: "Staging VPC containing private subnets used by ECS diagnostics.",
  });
  const stagingRdsSecurityGroupId = new cdk.CfnParameter(stack, "StagingRdsSecurityGroupId", {
    type: "AWS::EC2::SecurityGroup::Id",
    default: "sg-04aa58230942f9dc9",
    description: "Staging RDS PostgreSQL security group receiving diagnostic ingress.",
  });
  const stagingRdsAdminSecretArn = new cdk.CfnParameter(stack, "StagingRdsAdminSecretArn", {
    type: "String",
    noEcho: true,
    default: "arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-c18c1e63-98a4-4072-9654-9df53b9fe2e5-NcAenP",
    allowedPattern: "^arn:aws:secretsmanager:us-west-2:452630323448:secret:rds!db-[A-Za-z0-9-]+$",
    description: "Exact staging RDS-managed admin secret ARN for ECS execution-time injection.",
  });

  const diagnosticLogGroup = new logs.LogGroup(stack, "S2gDbAdminDiagnosticLogGroup", {
    logGroupName: "/genesis/staging/s2g-db-admin-diagnostic",
    retention: logs.RetentionDays.ONE_MONTH,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
  });

  const diagnosticRepository = new ecr.Repository(stack, "S2gDbAdminDiagnosticRepository", {
    repositoryName: "genesis-staging-s2g-db-admin-diagnostic",
    imageTagMutability: ecr.TagMutability.IMMUTABLE,
    imageScanOnPush: true,
    encryption: ecr.RepositoryEncryption.AES_256,
    lifecycleRules: [{
      description: "Retain only recent immutable diagnostic images",
      maxImageCount: 20,
    }],
  });

  const executionRole = new iam.Role(stack, "S2gDbAdminDiagnosticExecutionRole", {
    roleName: "genesis-staging-s2g-db-role-provision-execution-role",
    assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    description: "Dedicated execution role for staging S2G DB admin diagnostic task.",
  });
  executionRole.addToPolicy(new iam.PolicyStatement({
    sid: "EcrAuthorizationTokenForTaskStartup",
    effect: iam.Effect.ALLOW,
    actions: ["ecr:GetAuthorizationToken"],
    resources: ["*"],
  }));
  executionRole.addToPolicy(new iam.PolicyStatement({
    sid: "ReadOnlyDedicatedDiagnosticRepository",
    effect: iam.Effect.ALLOW,
    actions: [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ],
    resources: [diagnosticRepository.repositoryArn],
  }));
  executionRole.addToPolicy(new iam.PolicyStatement({
    sid: "WriteOnlyDedicatedDiagnosticLogStream",
    effect: iam.Effect.ALLOW,
    actions: ["logs:CreateLogStream", "logs:PutLogEvents"],
    resources: [`${diagnosticLogGroup.logGroupArn}:log-stream:*`],
  }));
  executionRole.addToPolicy(new iam.PolicyStatement({
    sid: "ReadExactStagingRdsAdminSecret",
    effect: iam.Effect.ALLOW,
    actions: ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
    resources: [stagingRdsAdminSecretArn.valueAsString],
  }));

  const taskRole = new iam.Role(stack, "S2gDbAdminDiagnosticTaskRole", {
    roleName: "genesis-staging-s2g-db-role-provision-task-role",
    assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    description: "Dedicated task role for staging S2G DB admin diagnostics with no AWS API permissions.",
  });

  const diagnosticSecurityGroup = new ec2.SecurityGroup(stack, "S2gDbAdminDiagnosticSecurityGroup", {
    vpc: ec2.Vpc.fromVpcAttributes(stack, "StagingVpc", {
      vpcId: vpcId.valueAsString,
      availabilityZones: ["us-west-2a", "us-west-2b"],
      privateSubnetIds: ["subnet-00a0b287895a3b18c", "subnet-0f303dea5f645e42d"],
    }),
    securityGroupName: "genesis-staging-s2g-db-admin-diagnostic-sg",
    description: "Egress-only security group for staging DB admin diagnostic task.",
    allowAllOutbound: false,
  });
  diagnosticSecurityGroup.addEgressRule(
    ec2.Peer.securityGroupId(stagingRdsSecurityGroupId.valueAsString),
    ec2.Port.tcp(5432),
    "Allow PostgreSQL egress to staging RDS security group only.",
  );
  diagnosticSecurityGroup.addEgressRule(
    ec2.Peer.anyIpv4(),
    ec2.Port.tcp(443),
    "Allow HTTPS egress for NAT-routed AWS service dependencies.",
  );

  new ec2.CfnSecurityGroupIngress(stack, "S2gDbAdminDiagnosticRdsIngress", {
    groupId: stagingRdsSecurityGroupId.valueAsString,
    ipProtocol: "tcp",
    fromPort: 5432,
    toPort: 5432,
    sourceSecurityGroupId: diagnosticSecurityGroup.securityGroupId,
    description: "Allow staging DB admin diagnostic task SG to reach PostgreSQL.",
  });

  new cdk.CfnOutput(stack, "DiagnosticExecutionRoleArn", { value: executionRole.roleArn });
  new cdk.CfnOutput(stack, "DiagnosticTaskRoleArn", { value: taskRole.roleArn });
  new cdk.CfnOutput(stack, "DiagnosticSecurityGroupId", { value: diagnosticSecurityGroup.securityGroupId });
  new cdk.CfnOutput(stack, "DiagnosticRepositoryUri", { value: diagnosticRepository.repositoryUri });
  new cdk.CfnOutput(stack, "DiagnosticLogGroupName", { value: diagnosticLogGroup.logGroupName });

  return stack;
}
