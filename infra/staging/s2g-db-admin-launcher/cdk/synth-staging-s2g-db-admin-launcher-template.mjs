import { App } from "aws-cdk-lib";
import { createStagingS2gDbAdminLauncherStack } from "./staging-s2g-db-admin-launcher-stack.mjs";

const app = new App();
const stack = createStagingS2gDbAdminLauncherStack(app);
const assembly = app.synth();
const artifact = assembly.getStackArtifact(stack.artifactId);
console.log(JSON.stringify(artifact.template, null, 2));
