import { App } from "aws-cdk-lib";
import { createStagingS2gDbAdminAuthorizationIdentityStack } from "./staging-s2g-db-admin-authorization-identity-stack.mjs";

const app = new App();
const stack = createStagingS2gDbAdminAuthorizationIdentityStack(app);
const assembly = app.synth();
const artifact = assembly.getStackArtifact(stack.artifactId);
console.log(JSON.stringify(artifact.template, null, 2));
