export function resolveGlwLaunchExecutionCapability(input: {
  nodeEnvironment: string | undefined;
  syntheticFlag: string | undefined;
}): boolean {
  return input.nodeEnvironment !== "production" && input.syntheticFlag === "true";
}

export function resolveGlwAtomicLaunchExecutionCapability(input: {
  nodeEnvironment: string | undefined;
  atomicFlag: string | undefined;
}): boolean {
  return input.nodeEnvironment !== "production" && input.atomicFlag === "true";
}