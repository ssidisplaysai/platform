import { CompilerArtifactManager } from "./CompilerArtifactManager";
import { CompilerContext } from "./CompilerContext";
import { CompilerDiagnosticsEngine } from "./CompilerDiagnosticsEngine";
import { CompilerManifestManager } from "./CompilerManifestManager";
import { CompilerPassRegistry } from "./CompilerPassRegistry";
import { CompilerSession } from "./CompilerSession";
import { CompilerValidationEngine } from "./CompilerValidationEngine";
import { CompilerVersionManager } from "./CompilerVersionManager";
import type { CompilerCoreInput, CompilerCoreOutput, CompilerPass } from "./types";
import type { DiscoveryPassOutput } from "./passes/DiscoveryCompilerPass";
import type { EvidencePassOutput } from "./passes/EvidenceCompilerPass";

function deterministicTopologicalSort(passes: CompilerPass<unknown, unknown>[]): CompilerPass<unknown, unknown>[] {
  const byId = new Map<string, CompilerPass<unknown, unknown>>();
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const pass of passes) {
    byId.set(pass.metadata.id, pass);
    inDegree.set(pass.metadata.id, 0);
    outgoing.set(pass.metadata.id, []);
  }

  for (const pass of passes) {
    for (const dep of pass.metadata.dependencies) {
      if (!byId.has(dep)) {
        throw new Error(`Pass ${pass.metadata.id} has unresolved dependency: ${dep}`);
      }

      inDegree.set(pass.metadata.id, (inDegree.get(pass.metadata.id) ?? 0) + 1);
      outgoing.get(dep)!.push(pass.metadata.id);
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort();

  const result: CompilerPass<unknown, unknown>[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(byId.get(id)!);

    for (const nextId of (outgoing.get(id) ?? []).sort()) {
      const nextDegree = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        queue.push(nextId);
        queue.sort();
      }
    }
  }

  if (result.length !== passes.length) {
    throw new Error("Cycle detected in compiler pass dependencies");
  }

  return result;
}

export class CompilerPipeline {
  readonly registry = new CompilerPassRegistry();
  readonly artifacts = new CompilerArtifactManager();
  readonly diagnostics = new CompilerDiagnosticsEngine();
  readonly validator = new CompilerValidationEngine();
  readonly versions = new CompilerVersionManager();
  readonly manifests = new CompilerManifestManager();

  async compile(input: CompilerCoreInput, sessionId?: string): Promise<CompilerCoreOutput> {
    const startedAt = new Date().toISOString();
    const session = new CompilerSession(sessionId, startedAt);
    const context = new CompilerContext(
      {
        compilerVersion: this.versions.getSnapshot().compilerCoreVersion,
        pipelineVersion: this.versions.getSnapshot().pipelineVersion,
        standards: {
          gps0001: "1.0",
          gps0002: "1.0",
          eir0001: "1.0",
          bgs0001: "1.0",
          bgc0001: "1.0",
          gcc0001: "1.0",
        },
      },
      session.id,
    );

    session.start();

    const orderedPasses = deterministicTopologicalSort(
      this.registry
        .list()
        .map((metadata) => this.registry.resolve(metadata.id)),
    );

    const passContractDiagnostics = this.validator.validatePassContracts(this.registry.list());
    for (const diagnostic of passContractDiagnostics) {
      this.diagnostics.report(diagnostic.severity, diagnostic.code, diagnostic.message, diagnostic.details, diagnostic.passId);
    }
    if (this.diagnostics.hasErrors()) {
      session.fail();
      throw new Error("Pass contract validation failed");
    }

    const passOutputs = new Map<string, unknown>();

    for (const pass of orderedPasses) {
      context.setPassStatus(pass.metadata.id, "running");
      this.versions.registerPassVersion(pass.metadata.id, pass.metadata.version);

      let passInput: unknown;
      if (pass.metadata.dependencies.length === 0) {
        passInput = input;
      } else if (pass.metadata.dependencies.length === 1) {
        passInput = passOutputs.get(pass.metadata.dependencies[0]!);
      } else {
        passInput = Object.fromEntries(pass.metadata.dependencies.map((dependencyId) => [dependencyId, passOutputs.get(dependencyId)]));
      }

      try {
        const output = await pass.execute(passInput as never, {
          sessionId: session.id,
          pipelineVersion: this.versions.getSnapshot().pipelineVersion,
        });

        passOutputs.set(pass.metadata.id, output);

        const artifact = this.artifacts.register(
          pass.metadata.outputType,
          pass.metadata.version,
          session.id,
          pass.metadata.id,
          output,
          pass.metadata.dependencies
            .map((dependencyId) => this.artifacts.list().find((entry) => entry.producedByPassId === dependencyId)?.id)
            .filter((entry): entry is string => Boolean(entry)),
          {
            passId: pass.metadata.id,
          },
        );

        context.registerArtifactId(artifact.id);
        context.setPassStatus(pass.metadata.id, "completed");
      } catch (error) {
        context.setPassStatus(pass.metadata.id, "failed");
        this.diagnostics.report(
          "error",
          "PASS_EXECUTION_FAILED",
          `Pass ${pass.metadata.id} failed: ${error instanceof Error ? error.message : String(error)}`,
          undefined,
          pass.metadata.id,
        );
        session.fail();
        throw error;
      }
    }

    const artifactDiagnostics = this.validator.validateArtifacts(this.artifacts.list());
    for (const diagnostic of artifactDiagnostics) {
      this.diagnostics.report(
        diagnostic.severity,
        diagnostic.code,
        diagnostic.message,
        diagnostic.details,
        diagnostic.passId,
        diagnostic.artifactId,
      );
    }

    const completedAt = new Date().toISOString();
    const manifest = this.manifests.buildManifest({
      sessionId: session.id,
      compilerVersion: this.versions.getSnapshot().compilerCoreVersion,
      pipelineVersion: this.versions.getSnapshot().pipelineVersion,
      passManifests: this.registry.list(),
      artifactIds: this.artifacts.list().map((artifact) => artifact.id),
      diagnostics: this.diagnostics.list(),
      startedAt,
      completedAt,
      sourceManifest: {
        sourceType: input.source.sourceType,
        sourceId: input.source.id,
      },
      standards: context.config.standards,
    });

    const manifestDiagnostics = this.validator.validateManifest(manifest);
    for (const diagnostic of manifestDiagnostics) {
      this.diagnostics.report(diagnostic.severity, diagnostic.code, diagnostic.message, diagnostic.details);
    }

    if (this.diagnostics.hasErrors()) {
      session.fail();
      throw new Error("Compiler pipeline validation failed");
    }

    session.complete(completedAt);

    const discoveryOutput = passOutputs.get("discovery-pass") as DiscoveryPassOutput | undefined;
    const evidenceOutput = passOutputs.get("evidence-pass") as EvidencePassOutput | undefined;

    if (!discoveryOutput || !evidenceOutput) {
      throw new Error("Required pass outputs missing: discovery-pass and evidence-pass");
    }

    return {
      artifacts: discoveryOutput.artifacts,
      evidenceIR: evidenceOutput.evidenceIR,
      manifest,
    };
  }
}
