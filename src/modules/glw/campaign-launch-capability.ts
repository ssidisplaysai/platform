export type GlwCampaignLaunchPromotionState =
  | "DISABLED"
  | "ENABLED_CERTIFIED_RELEASE"
  | "RELEASE_MISMATCH"
  | "CONFIGURATION_INVALID"
  | "UNAVAILABLE"
  | "DEVELOPMENT_ENABLED";

export type GlwCampaignLaunchPromotion = {
  available: boolean;
  state: GlwCampaignLaunchPromotionState;
  reason: string;
  runningRelease: string | null;
  certifiedRelease: string | null;
};

const EXACT_RELEASE_PATTERN = /^[0-9a-f]{40}$/;

function exactRelease(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return EXACT_RELEASE_PATTERN.test(normalized) ? normalized : null;
}

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
  return resolveGlwCampaignLaunchPromotion({
    nodeEnvironment: input.nodeEnvironment,
    developmentAtomicFlag: input.atomicFlag,
  }).available;
}

export function resolveGlwCampaignLaunchPromotion(input: {
  nodeEnvironment: string | undefined;
  developmentAtomicFlag?: string | undefined;
  productionEnabled?: string | undefined;
  certifiedRelease?: string | undefined;
  runningRelease?: string | undefined;
}): GlwCampaignLaunchPromotion {
  if (input.nodeEnvironment !== "production") {
    const available = input.developmentAtomicFlag === "true";
    return {
      available,
      state: available ? "DEVELOPMENT_ENABLED" : "DISABLED",
      reason: available
        ? "Atomic campaign launch is enabled for this isolated development runtime."
        : "Atomic campaign launch is disabled for this development runtime.",
      runningRelease: exactRelease(input.runningRelease),
      certifiedRelease: exactRelease(input.certifiedRelease),
    };
  }

  if (!input.productionEnabled || input.productionEnabled === "false") {
    return {
      available: false,
      state: "DISABLED",
      reason: "Campaign Launch is not enabled for this production release.",
      runningRelease: exactRelease(input.runningRelease),
      certifiedRelease: exactRelease(input.certifiedRelease),
    };
  }
  if (input.productionEnabled !== "true") {
    return {
      available: false,
      state: "CONFIGURATION_INVALID",
      reason: "Campaign Launch production promotion configuration is invalid.",
      runningRelease: exactRelease(input.runningRelease),
      certifiedRelease: exactRelease(input.certifiedRelease),
    };
  }

  const certifiedRelease = exactRelease(input.certifiedRelease);
  if (!certifiedRelease) {
    return {
      available: false,
      state: "CONFIGURATION_INVALID",
      reason: "The promoted Campaign Launch release identity is missing or invalid.",
      runningRelease: exactRelease(input.runningRelease),
      certifiedRelease: null,
    };
  }
  const runningRelease = exactRelease(input.runningRelease);
  if (!runningRelease) {
    return {
      available: false,
      state: "UNAVAILABLE",
      reason: "The running production release identity is unavailable.",
      runningRelease: null,
      certifiedRelease,
    };
  }
  if (runningRelease !== certifiedRelease) {
    return {
      available: false,
      state: "RELEASE_MISMATCH",
      reason: "Campaign Launch is not enabled for this production release.",
      runningRelease,
      certifiedRelease,
    };
  }
  return {
    available: true,
    state: "ENABLED_CERTIFIED_RELEASE",
    reason: "Campaign Launch is available for this certified production release.",
    runningRelease,
    certifiedRelease,
  };
}

export function readGlwCampaignLaunchPromotion(): GlwCampaignLaunchPromotion {
  return resolveGlwCampaignLaunchPromotion({
    nodeEnvironment: process.env.NODE_ENV,
    developmentAtomicFlag: process.env.GLW_LAUNCHPAD_ATOMIC_LAUNCH,
    productionEnabled: process.env.GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED,
    certifiedRelease: process.env.GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE,
    runningRelease: process.env.GIT_COMMIT,
  });
}