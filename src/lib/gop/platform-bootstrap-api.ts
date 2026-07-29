import type {
  GenesisAuthorizationSubject,
  GenesisNavigationItem,
  GenesisWorkspaceDescriptor,
} from "@/platform/gop/contracts";
import { getGenesisNavigationItems } from "@/platform/gop/runtime/loader";
import { getGenesisWorkspaceRegistry, resolveAuthorizedWorkspaces } from "@/platform/gop/workspaces/runtime";

export type GenesisPlatformBootstrapState = {
  initialized: boolean;
  workspaceResolved: boolean;
  navigationResolved: boolean;
  issueCode?: "NO_AUTHORIZED_WORKSPACE" | "NO_WORKSPACE";
};

export type GenesisPlatformCapabilities = {
  enabledModuleIds: string[];
  featureFlags: string[];
};

export type GenesisPlatformBootstrapContext = {
  subject: GenesisAuthorizationSubject;
  workspaceDescriptors: GenesisWorkspaceDescriptor[];
};

export type GenesisPlatformBootstrapResult = {
  workspace: GenesisWorkspaceDescriptor | null;
  navigationItems: GenesisNavigationItem[];
  capabilities: GenesisPlatformCapabilities;
  state: GenesisPlatformBootstrapState;
};

export function loadWorkspace(context: GenesisPlatformBootstrapContext): GenesisWorkspaceDescriptor | null {
  const authorizedWorkspaces = resolveAuthorizedWorkspaces(context.subject, context.workspaceDescriptors);
  if (authorizedWorkspaces.length === 0) {
    return null;
  }

  return authorizedWorkspaces[0] ?? getGenesisWorkspaceRegistry(context.workspaceDescriptors).list()[0] ?? null;
}

export function resolveNavigation(
  context: GenesisPlatformBootstrapContext,
  workspace: GenesisWorkspaceDescriptor,
): GenesisNavigationItem[] {
  return getGenesisNavigationItems({
    subject: context.subject,
    workspaceId: workspace.workspaceId,
  });
}

export function resolveCapabilities(workspace: GenesisWorkspaceDescriptor): GenesisPlatformCapabilities {
  return {
    enabledModuleIds: [...workspace.enabledModuleIds],
    featureFlags: [...(workspace.featureFlags ?? [])],
  };
}

export function getBootstrapState(input: {
  workspace: GenesisWorkspaceDescriptor | null;
  navigationItems: GenesisNavigationItem[];
}): GenesisPlatformBootstrapState {
  if (!input.workspace) {
    return {
      initialized: false,
      workspaceResolved: false,
      navigationResolved: false,
      issueCode: "NO_AUTHORIZED_WORKSPACE",
    };
  }

  return {
    initialized: true,
    workspaceResolved: true,
    navigationResolved: input.navigationItems.length >= 0,
  };
}

export function initializePlatform(context: GenesisPlatformBootstrapContext): GenesisPlatformBootstrapResult {
  const workspace = loadWorkspace(context);
  if (!workspace) {
    return {
      workspace: null,
      navigationItems: [],
      capabilities: {
        enabledModuleIds: [],
        featureFlags: [],
      },
      state: {
        initialized: false,
        workspaceResolved: false,
        navigationResolved: false,
        issueCode: "NO_AUTHORIZED_WORKSPACE",
      },
    };
  }

  const navigationItems = resolveNavigation(context, workspace);
  const capabilities = resolveCapabilities(workspace);

  return {
    workspace,
    navigationItems,
    capabilities,
    state: getBootstrapState({ workspace, navigationItems }),
  };
}
