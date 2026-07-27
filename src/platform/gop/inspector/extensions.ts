import type { ReactNode } from "react";
import { createActionReference } from "../auth/resolver";
import { getGenesisAuthorizationResolver } from "../auth/runtime";
import type { GenesisAuthorizationSubject, GenesisJob } from "../contracts";

export type GenesisInspectorExtensionContext = {
  moduleId: string;
  job: GenesisJob;
  workspaceId?: string;
  subject?: GenesisAuthorizationSubject;
};

export type GenesisInspectorExtension = {
  extensionId: string;
  moduleId: string;
  order?: number;
  requiredPermission?: string;
  supportedJobTypes?: string[];
  supportedJobStatuses?: string[];
  featureFlags?: string[];
  isEnabled?: (context: GenesisInspectorExtensionContext) => boolean;
  renderSection: (context: GenesisInspectorExtensionContext) => ReactNode;
};

export type GenesisInspectorExtensionQuery = {
  moduleId: string;
  context?: GenesisInspectorExtensionContext;
};

const extensionRegistry = new Map<string, GenesisInspectorExtension[]>();

export function registerGenesisInspectorExtension(extension: GenesisInspectorExtension): void {
  const existing = extensionRegistry.get(extension.moduleId) ?? [];
  extensionRegistry.set(extension.moduleId, [...existing, extension]);
}

function isFeatureEnabled(extension: GenesisInspectorExtension, context: GenesisInspectorExtensionContext): boolean {
  if (!extension.featureFlags || extension.featureFlags.length === 0) {
    return true;
  }

  const enabled = new Set<string>(
    ((context.job.context?.metadata as Record<string, unknown> | undefined)?.featureFlags as string[] | undefined) ?? [],
  );

  return extension.featureFlags.some((flag) => enabled.has(flag));
}

function isAuthorized(extension: GenesisInspectorExtension, context: GenesisInspectorExtensionContext): boolean {
  if (!context.subject) {
    return true;
  }

  const decision = getGenesisAuthorizationResolver().authorize({
    subject: context.subject,
    workspaceId: context.workspaceId,
    moduleId: context.moduleId,
    route: undefined,
    jobType: context.job.type,
    jobStatus: context.job.status,
    action: createActionReference("extension:view", "inspector_extension"),
    resource: {
      workspaceId: context.workspaceId,
      moduleId: context.moduleId,
      jobId: context.job.jobId,
      jobType: context.job.type,
      jobStatus: context.job.status,
      extensionId: extension.extensionId,
      ownerActorId: context.job.context?.metadata
        ? (context.job.context.metadata as Record<string, unknown>).ownerActorId as string | undefined
        : undefined,
    },
  });

  if (!decision.allowed) {
    return false;
  }

  if (extension.requiredPermission && !context.subject.permissions.includes(extension.requiredPermission)) {
    return false;
  }

  return true;
}

export function getGenesisInspectorExtensions(query: string | GenesisInspectorExtensionQuery): GenesisInspectorExtension[] {
  const moduleId = typeof query === "string" ? query : query.moduleId;
  const context = typeof query === "string" ? undefined : query.context;
  const existing = extensionRegistry.get(moduleId) ?? [];

  return [...existing]
    .filter((extension) => {
      if (!context) {
        return true;
      }

      if (extension.supportedJobTypes && !extension.supportedJobTypes.includes(context.job.type)) {
        return false;
      }

      if (extension.supportedJobStatuses && !extension.supportedJobStatuses.includes(context.job.status)) {
        return false;
      }

      if (!isFeatureEnabled(extension, context)) {
        return false;
      }

      if (!isAuthorized(extension, context)) {
        return false;
      }

      return extension.isEnabled ? extension.isEnabled(context) : true;
    })
    .sort((left, right) => (left.order ?? 1000) - (right.order ?? 1000));
}

export function clearGenesisInspectorExtensionsForTests(): void {
  extensionRegistry.clear();
}
