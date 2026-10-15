import { App } from "aws-cdk-lib";
import { createStagingSnapshotExportStack } from "./staging-snapshot-export-stack.mjs";

const app = new App();
const stack = createStagingSnapshotExportStack(app);
const assembly = app.synth();
const artifact = assembly.getStackArtifact(stack.artifactId);
console.log(JSON.stringify(artifact.template, null, 2));

