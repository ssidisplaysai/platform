export interface CompilerVersionSnapshot {
  compilerCoreVersion: string;
  pipelineVersion: string;
  manifestVersion: string;
  passVersions: Record<string, string>;
  compatibility: {
    minimumCompilerCoreVersion: string;
    minimumPipelineVersion: string;
  };
  migrationMetadata: {
    deprecatedPasses: string[];
    replacements: Record<string, string>;
  };
}

export class CompilerVersionManager {
  private readonly snapshot: CompilerVersionSnapshot;

  constructor(snapshot?: Partial<CompilerVersionSnapshot>) {
    this.snapshot = {
      compilerCoreVersion: snapshot?.compilerCoreVersion ?? "1.0.0",
      pipelineVersion: snapshot?.pipelineVersion ?? "1.0.0",
      manifestVersion: snapshot?.manifestVersion ?? "1.0.0",
      passVersions: snapshot?.passVersions ?? {},
      compatibility: snapshot?.compatibility ?? {
        minimumCompilerCoreVersion: "1.0.0",
        minimumPipelineVersion: "1.0.0",
      },
      migrationMetadata: snapshot?.migrationMetadata ?? {
        deprecatedPasses: [],
        replacements: {},
      },
    };
  }

  registerPassVersion(passId: string, version: string): void {
    this.snapshot.passVersions[passId] = version;
  }

  markPassDeprecated(passId: string, replacementPassId?: string): void {
    if (!this.snapshot.migrationMetadata.deprecatedPasses.includes(passId)) {
      this.snapshot.migrationMetadata.deprecatedPasses.push(passId);
      this.snapshot.migrationMetadata.deprecatedPasses.sort();
    }

    if (replacementPassId) {
      this.snapshot.migrationMetadata.replacements[passId] = replacementPassId;
    }
  }

  getSnapshot(): CompilerVersionSnapshot {
    return {
      ...this.snapshot,
      passVersions: { ...this.snapshot.passVersions },
      compatibility: { ...this.snapshot.compatibility },
      migrationMetadata: {
        deprecatedPasses: [...this.snapshot.migrationMetadata.deprecatedPasses],
        replacements: { ...this.snapshot.migrationMetadata.replacements },
      },
    };
  }
}
