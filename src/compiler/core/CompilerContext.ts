import type { CompilerManifest } from "./types";

export interface CompilerContextConfig {
  readonly compilerVersion: string;
  readonly pipelineVersion: string;
  readonly standards: CompilerManifest["standards"];
}

export interface CompilerContextState {
  sessionId: string;
  passStatuses: Record<string, "pending" | "running" | "completed" | "failed">;
  artifactIds: string[];
  manifestIds: string[];
}

export class CompilerContext {
  readonly config: CompilerContextConfig;
  private readonly sharedReferences: Map<string, string> = new Map<string, string>();
  private readonly state: CompilerContextState;

  constructor(config: CompilerContextConfig, sessionId: string) {
    this.config = config;
    this.state = {
      sessionId,
      passStatuses: {},
      artifactIds: [],
      manifestIds: [],
    };
  }

  registerReference(key: string, value: string): void {
    this.sharedReferences.set(key, value);
  }

  getReference(key: string): string | undefined {
    return this.sharedReferences.get(key);
  }

  setPassStatus(passId: string, status: "pending" | "running" | "completed" | "failed"): void {
    this.state.passStatuses[passId] = status;
  }

  registerArtifactId(artifactId: string): void {
    this.state.artifactIds.push(artifactId);
  }

  registerManifestId(manifestId: string): void {
    this.state.manifestIds.push(manifestId);
  }

  snapshotState(): CompilerContextState {
    return {
      sessionId: this.state.sessionId,
      passStatuses: { ...this.state.passStatuses },
      artifactIds: [...this.state.artifactIds],
      manifestIds: [...this.state.manifestIds],
    };
  }
}
