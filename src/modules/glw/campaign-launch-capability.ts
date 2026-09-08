export function resolveGlwLaunchExecutionCapability(input: {
  nodeEnvironment: string | undefined;
  syntheticFlag: string | undefined;
}): boolean {
  return input.nodeEnvironment !== "production" && input.syntheticFlag === "true";
}