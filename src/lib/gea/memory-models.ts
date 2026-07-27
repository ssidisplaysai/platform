import { geaId, nowIso, stableChecksum, stableStringify } from "./agent-models";

export type AuthorityState = "CERTIFIED" | "VERIFIED" | "UNVERIFIED";
export type ContextLifecycleState = "ASSEMBLED" | "VALIDATED" | "ACTIVE" | "DEPRECATED" | "ARCHIVED";
export type ContextHealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";

export type MemorySource = {
  memorySourceId: string;
  workspaceId: string;
  organizationId: string;
  sourceType: "BUSINESS_GENOME" | "EVIDENCE" | "MARKETING_KERNEL" | "ENTERPRISE_TOOL" | "DOCUMENT" | "ARTIFACT" | "REGISTRY";
  sourceId: string;
  sourceVersion: string;
  authoritative: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MemoryVersion = {
  memoryVersionId: string;
  memoryReferenceId: string;
  versionTag: string;
  checksum: string;
  createdAt: string;
};

export type MemoryReference = {
  memoryReferenceId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string;
  registryIdentity: string;
  referenceType: "BUSINESS_GENOME" | "EVIDENCE_SNAPSHOT" | "TOOL_EXECUTION" | "DOCUMENT" | "ARTIFACT" | "KNOWLEDGE_NODE";
  referenceId: string;
  referenceVersion: string;
  source: MemorySource;
  memoryVersion: MemoryVersion;
  capabilityKey?: string;
  permissionAction?: string;
  authorityState: AuthorityState;
  immutable: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MemoryCollection = {
  memoryCollectionId: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  description?: string;
  lifecycleState: ContextLifecycleState;
  memoryReferenceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type MemorySnapshot = {
  memorySnapshotId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string;
  memoryCollectionId?: string;
  memoryReferenceIds: string[];
  snapshotChecksum: string;
  createdAt: string;
};

export type ContextDependency = {
  contextDependencyId: string;
  dependencyType: "MEMORY_REFERENCE" | "SOURCE" | "TOOL_VERSION" | "GENOME_VERSION" | "RUNTIME_VERSION";
  dependencyReferenceId: string;
  dependencyVersion: string;
};

export type ContextSection = {
  sectionId: string;
  sourceType: MemorySource["sourceType"];
  title: string;
  order: number;
  references: Array<{
    memoryReferenceId: string;
    referenceType: MemoryReference["referenceType"];
    referenceId: string;
    referenceVersion: string;
    authorityState: AuthorityState;
    provenance: {
      sourceId: string;
      sourceVersion: string;
      artifactId: string;
      timestamp: string;
      workspaceId: string;
      projectId?: string;
      registryIdentity: string;
      validationState: "PASSED" | "FAILED";
    };
    metadata?: Record<string, unknown>;
  }>;
};

export type ContextTimeline = {
  sequence: number;
  at: string;
  eventType: "ASSEMBLY_STARTED" | "AUTHORIZATION_FILTERED" | "OPTIMIZED" | "CACHED" | "VALIDATED" | "REPLAYED";
  note: string;
  metadata?: Record<string, unknown>;
};

export type ContextPolicy = {
  policyVersion: string;
  defaultDeny: boolean;
  requireAuthoritativeSources: boolean;
  deterministicOrdering: boolean;
  cacheEnabled: boolean;
  maxReferences: number;
  maxSections: number;
};

export type ContextAssembly = {
  assemblyVersion: string;
  runtimeVersion: string;
  genomeVersion: string;
  toolVersions: Record<string, string>;
  sourceVersions: Record<string, string>;
  builtAt: string;
  builtBy: string;
  deterministic: boolean;
  buildLatencyMs: number;
};

export type ContextValidation = {
  contextValidationId: string;
  contextPackageId: string;
  validationStatus: "PASSED" | "FAILED";
  issues: string[];
  validatedAt: string;
};

export type ContextReplay = {
  contextReplayId: string;
  contextPackageId: string;
  replayChecksum: string;
  deterministicPossible: boolean;
  deterministicMatch?: boolean;
  reason?: string;
  createdAt: string;
};

export type ContextCache = {
  contextCacheId: string;
  workspaceId: string;
  organizationId: string;
  cacheKey: string;
  contextPackageId: string;
  sourceVersionFingerprint: string;
  cacheStatus: "ACTIVE" | "INVALIDATED";
  hitCount: number;
  lastHitAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContextHealth = {
  contextHealthId: string;
  workspaceId: string;
  organizationId: string;
  assemblyLatencyMs: number;
  cacheUtilization: number;
  validationFailures: number;
  authorizationFailures: number;
  missingReferences: number;
  staleReferences: number;
  versionDrift: number;
  healthStatus: ContextHealthStatus;
  computedAt: string;
};

export type ContextPackage = {
  contextPackageId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string;
  agentId?: string;
  lifecycleState: ContextLifecycleState;
  contextVersion: string;
  sections: ContextSection[];
  dependencies: ContextDependency[];
  assembly: ContextAssembly;
  policy: ContextPolicy;
  timeline: ContextTimeline[];
  packageChecksum: string;
  cacheKey: string;
  deterministic: boolean;
  createdAt: string;
};

export function defaultContextPolicy(): ContextPolicy {
  return {
    policyVersion: "gea-context-policy/v1",
    defaultDeny: true,
    requireAuthoritativeSources: true,
    deterministicOrdering: true,
    cacheEnabled: true,
    maxReferences: 400,
    maxSections: 60,
  };
}

export function createContextChecksum(input: {
  workspaceId: string;
  projectId?: string;
  references: MemoryReference[];
  assemblyVersion: string;
  sourceVersions: Record<string, string>;
  policyVersion: string;
}): string {
  return stableChecksum(input);
}

export function createContextCacheKey(input: {
  workspaceId: string;
  organizationId: string;
  projectId?: string;
  referenceKeys: string[];
  sourceVersions: Record<string, string>;
  policyVersion: string;
}): string {
  return stableChecksum(input);
}

export function createSourceVersionFingerprint(sourceVersions: Record<string, string>): string {
  return stableChecksum(sourceVersions);
}

export function deterministicSortReferences(references: MemoryReference[]): MemoryReference[] {
  const copy = [...references];
  copy.sort((a, b) => {
    const keyA = `${a.source.sourceType}|${a.referenceType}|${a.referenceId}|${a.referenceVersion}|${a.registryIdentity}`;
    const keyB = `${b.source.sourceType}|${b.referenceType}|${b.referenceId}|${b.referenceVersion}|${b.registryIdentity}`;
    return keyA.localeCompare(keyB);
  });
  return copy;
}

export function stableContextSectionSignature(section: ContextSection): string {
  return stableStringify(section);
}

export function createContextIds() {
  return {
    memoryReferenceId: geaId("geamemref"),
    memorySourceId: geaId("geamemsrc"),
    memoryVersionId: geaId("geamemver"),
    memoryCollectionId: geaId("geamemcol"),
    memorySnapshotId: geaId("geamemsnap"),
    contextPackageId: geaId("geactxpkg"),
    contextDependencyId: geaId("geactxdep"),
    contextValidationId: geaId("geactxval"),
    contextReplayId: geaId("geactxreplay"),
    contextCacheId: geaId("geactxcache"),
    contextHealthId: geaId("geactxhealth"),
    contextSectionId: geaId("geactxsec"),
  };
}

export function currentAssemblyVersion(): string {
  return "gea-context-assembly/v1";
}

export function currentRuntimeVersion(): string {
  return "gea-context-runtime/v1";
}

export function nowIsoSafe(): string {
  return nowIso();
}
