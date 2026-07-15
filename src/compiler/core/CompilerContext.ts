import type { CompilerManifest } from "./types";

export interface CompilerContextConfig {
  readonly compilerVersion: string;
  readonly pipelineVersion: string;
  readonly standards: CompilerManifest["standards"];
}

export interface CompilerContextState {
  readonly sessionId: string;
  readonly passStatuses: Readonly<Record<string, "pending" | "running" | "completed" | "failed" | "cancelled">>;
  readonly artifactIds: readonly string[];
  readonly manifestIds: readonly string[];
}

export class CompilerContext {
  readonly config: CompilerContextConfig;
  private readonly sharedReferences: Map<string, string> = new Map<string, string>();
  private passStatuses: Record<string, "pending" | "running" | "completed" | "failed" | "cancelled">;
  private artifactIds: string[];
  private manifestIds: string[];
  private readonly sessionId: string;

  constructor(config: CompilerContextConfig, sessionId: string) {
    this.config = config;
    this.sessionId = sessionId;
    this.passStatuses = {};
    this.artifactIds = [];
    this.manifestIds = [];
  }

  registerReference(key: string, value: string): void {
    this.sharedReferences.set(key, value);
  }

  getReference(key: string): string | undefined {
    return this.sharedReferences.get(key);
  }

  setPassStatus(passId: string, status: "pending" | "running" | "completed" | "failed" | "cancelled"): void {
    this.passStatuses = {
      ...this.passStatuses,
      [passId]: status,
    };
  }

  registerArtifactId(artifactId: string): void {
    this.artifactIds = [...this.artifactIds, artifactId].sort();
  }

  registerManifestId(manifestId: string): void {
    this.manifestIds = [...this.manifestIds, manifestId].sort();
  }

  snapshotState(): CompilerContextState {
    return {
      sessionId: this.sessionId,
      passStatuses: { ...this.passStatuses },
      artifactIds: [...this.artifactIds],
      manifestIds: [...this.manifestIds],
    };
  }
}
