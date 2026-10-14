import { App } from "aws-cdk-lib";
import { createStagingS2gDbAdminDiagnosticPrerequisitesStack } from "./staging-s2g-db-admin-diagnostic-prerequisites-stack.mjs";

const app = new App();
const stack = createStagingS2gDbAdminDiagnosticPrerequisitesStack(app);
const assembly = app.synth();
const artifact = assembly.getStackArtifact(stack.artifactId);
console.log(JSON.stringify(artifact.template, null, 2));
