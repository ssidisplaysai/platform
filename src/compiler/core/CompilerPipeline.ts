import { ArtifactRegistry } from "./ArtifactRegistry";
import { Compilation } from "./Compilation";
import { CompilationTransaction } from "./CompilationTransaction";
import { CompilerCancellation } from "./CompilerCancellation";
import { createCompilerConfiguration } from "./CompilerConfiguration";
import { CompilerDiagnostics } from "./CompilerDiagnostics";
import { CompilerError } from "./CompilerError";
import { CompilerEventBus } from "./CompilerEventBus";
import { CompilerException } from "./CompilerException";
import { CompilerLogger } from "./CompilerLogger";
import { CompilerManifestManager } from "./CompilerManifestManager";
import { CompilerMetrics } from "./CompilerMetrics";
import { CompilerPassRegistry } from "./CompilerPassRegistry";
import { CompilerSession } from "./CompilerSession";
import { CompilerTelemetry } from "./CompilerTelemetry";
import { CompilerValidationEngine } from "./CompilerValidationEngine";
import { CompilerVersionManager } from "./CompilerVersionManager";
import type {
  CompilerConfiguration,
  CompilerDiagnostic,
  CompilerEvent,
  CompilerEventType,
  CompilerPass,
  CompilerPassContext,
  CompilerResult,
} from "./types";

export interface CompilerPipelineDependencies {
  readonly registry?: CompilerPassRegistry;
  readonly eventBus?: CompilerEventBus;
  readonly logger?: CompilerLogger;
  readonly configuration?: Partial<CompilerConfiguration>;
  readonly artifactRegistry?: ArtifactRegistry;
  readonly manifestManager?: CompilerManifestManager;
  readonly validationEngine?: CompilerValidationEngine;
  readonly versionManager?: CompilerVersionManager;
}

export interface CompileOptions {
  readonly sessionId?: string;
  readonly cancellation?: CompilerCancellation;
  readonly startedAt?: string;
}

export class CompilerPipeline {
  readonly registry: CompilerPassRegistry;
  readonly artifacts: ArtifactRegistry;
  readonly diagnostics: CompilerDiagnostics;
  readonly validator: CompilerValidationEngine;
  readonly versions: CompilerVersionManager;
  readonly manifests: CompilerManifestManager;
  readonly eventBus: CompilerEventBus;
  readonly logger: CompilerLogger;
  readonly configuration: CompilerConfiguration;

  constructor(dependencies: CompilerPipelineDependencies = {}) {
    this.registry = dependencies.registry ?? new CompilerPassRegistry();
    this.artifacts = dependencies.artifactRegistry ?? new ArtifactRegistry();
    this.diagnostics = new CompilerDiagnostics();
    this.validator = dependencies.validationEngine ?? new CompilerValidationEngine();
    this.versions = dependencies.versionManager ?? new CompilerVersionManager();
    this.manifests = dependencies.manifestManager ?? new CompilerManifestManager();
    this.eventBus = dependencies.eventBus ?? new CompilerEventBus();
    this.logger = dependencies.logger ?? new CompilerLogger();
    this.configuration = createCompilerConfiguration(dependencies.configuration);
  }

  async compile<TInput>(input: TInput, options: string | CompileOptions = {}): Promise<CompilerResult> {
    const normalizedOptions = typeof options === "string" ? { sessionId: options } : options;
    const startedAt = normalizedOptions.startedAt ?? new Date().toISOString();
    const session = new CompilerSession(normalizedOptions.sessionId, startedAt);
    const compilation = new Compilation(input, session.id, startedAt);
    const cancellation = normalizedOptions.cancellation ?? new CompilerCancellation();
    const metrics = new CompilerMetrics(startedAt);
    const telemetry = new CompilerTelemetry(compilation.id, session.id);
    const transaction = new CompilationTransaction();
    const passOutputs = new Map<string, unknown>();

    const registryDiagnostics = [...this.registry.validate(), ...this.validator.validatePassContracts(this.registry.list())];
    this.diagnostics.clear();
    this.diagnostics.add(registryDiagnostics);

    if (this.diagnostics.hasErrors()) {
      session.start();
      session.fail(startedAt);
      compilation.markFailed();
      metrics.incrementErrors(this.diagnostics.listBySeverity("error").length + this.diagnostics.listBySeverity("fatal").length);
      metrics.complete(startedAt, 0);
      const manifest = this.buildManifest(session.id, input, startedAt, startedAt);
      return this.buildResult(compilation, session.id, metrics, telemetry, manifest);
    }

    const plan = this.registry.createExecutionPlan(this.configuration.pipelineVersion);
    metrics.setPassCount(plan.steps.length);

    session.start();
    compilation.markRunning();
    this.publishEvent("CompilationStarted", compilation.id, session.id, startedAt, undefined, "running", {
      planId: plan.id,
      passCount: plan.steps.length,
    }, metrics, telemetry);

    try {
      for (const step of plan.steps) {
        cancellation.throwIfCancelled();
        const pass = this.registry.resolve(step.passId);
        const passInput = this.resolvePassInput(input, pass);
        const context = this.createPassContext(session.id, compilation.id, cancellation, passOutputs);
        const passStartedMs = Date.now();
        const passTimestamp = new Date().toISOString();

        if (pass.validate) {
          this.publishEvent("ValidationStarted", compilation.id, session.id, passTimestamp, pass.metadata.id, "running", {}, metrics, telemetry);
          const validationDiagnostics = await pass.validate(passInput, context);
          this.diagnostics.add(validationDiagnostics);
          this.applyDiagnosticMetrics(validationDiagnostics, metrics);
          this.publishEvent("ValidationCompleted", compilation.id, session.id, new Date().toISOString(), pass.metadata.id, "running", {
            diagnosticCount: validationDiagnostics.length,
          }, metrics, telemetry);

          if (this.configuration.failOnValidationError && validationDiagnostics.some((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "fatal")) {
            throw new CompilerError("PASS_VALIDATION_FAILED", `Validation failed for pass ${pass.metadata.id}`);
          }
        }

        this.publishEvent("PassStarted", compilation.id, session.id, passTimestamp, pass.metadata.id, "running", {}, metrics, telemetry);
        const output = await pass.execute(passInput, context);
        passOutputs.set(pass.metadata.id, output);
        compilation.registerOutput(pass.metadata.id, output);

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
            description: pass.metadata.description,
            kind: pass.metadata.kind ?? "execution",
          },
        );
        compilation.registerArtifact(artifact);
        metrics.incrementArtifacts();
        transaction.register(pass.metadata.id, pass.rollback ? () => pass.rollback?.(output, context) : undefined);
        metrics.incrementCompletedPasses();

        const completedTimestamp = new Date().toISOString();
        telemetry.recordPassDuration(pass.metadata.id, Date.now() - passStartedMs);
        this.publishEvent("PassCompleted", compilation.id, session.id, completedTimestamp, pass.metadata.id, "running", {
          artifactId: artifact.id,
        }, metrics, telemetry);

        const stageEvent = toStageCompletionEvent(pass.metadata.kind, pass.metadata.id);
        if (stageEvent) {
          this.publishEvent(stageEvent, compilation.id, session.id, completedTimestamp, pass.metadata.id, "running", {
            artifactId: artifact.id,
          }, metrics, telemetry);
        }
      }

      const completedAt = new Date().toISOString();
      session.complete(completedAt);
      compilation.markCompleted();
      const manifest = this.buildManifest(session.id, input, startedAt, completedAt);
      const manifestDiagnostics = this.validator.validateManifest(manifest);
      this.diagnostics.add(manifestDiagnostics);
      this.applyDiagnosticMetrics(manifestDiagnostics, metrics);
      metrics.complete(completedAt, Date.parse(completedAt) - Date.parse(startedAt));
      this.publishEvent("CompilationCompleted", compilation.id, session.id, completedAt, undefined, "completed", {
        artifactCount: this.artifacts.list().length,
      }, metrics, telemetry);
      return this.buildResult(compilation, session.id, metrics, telemetry, manifest);
    } catch (error) {
      const failedAt = new Date().toISOString();
      const diagnostics = [this.createFailureDiagnostic(error)];
      this.diagnostics.add(diagnostics);
      this.applyDiagnosticMetrics(diagnostics, metrics);
      metrics.incrementFailedPasses();

      if (error instanceof CompilerException && error.code === "COMPILATION_CANCELLED") {
        session.cancel(failedAt);
        compilation.markCancelled();
      } else {
        session.fail(failedAt);
        compilation.markFailed();
      }

      const rolledBack = await transaction.rollback();
      if (rolledBack.length > 0) {
        metrics.incrementRollbacks(rolledBack.length);
      }

      const manifest = this.buildManifest(session.id, input, startedAt, failedAt);
      metrics.complete(failedAt, Date.parse(failedAt) - Date.parse(startedAt));
      this.publishEvent("CompilationFailed", compilation.id, session.id, failedAt, undefined, compilation.getStatus(), {
        rollbackCount: rolledBack.length,
      }, metrics, telemetry);
      return this.buildResult(compilation, session.id, metrics, telemetry, manifest);
    }
  }

  private resolvePassInput<TInput>(input: TInput, pass: CompilerPass<unknown, unknown>): unknown {
    if (pass.metadata.dependencies.length === 0) {
      return input;
    }

    if (pass.metadata.dependencies.length === 1) {
      return this.artifacts.list().find((entry) => entry.producedByPassId === pass.metadata.dependencies[0])?.payload;
    }

    return Object.freeze(
      Object.fromEntries(
        pass.metadata.dependencies
          .slice()
          .sort()
          .map((dependencyId) => [
            dependencyId,
            this.artifacts.list().find((entry) => entry.producedByPassId === dependencyId)?.payload,
          ]),
      ),
    );
  }

  private createPassContext(
    sessionId: string,
    compilationId: string,
    cancellation: CompilerCancellation,
    passOutputs: Map<string, unknown>,
  ): CompilerPassContext {
    return {
      sessionId,
      compilationId,
      pipelineVersion: this.configuration.pipelineVersion,
      configuration: this.configuration,
      signal: cancellation.snapshot,
      logger: this.logger,
      eventBus: this.eventBus,
      getOutput: <T>(passId: string) => passOutputs.get(passId) as T | undefined,
      registerArtifact: (
        type: string,
        version: string,
        producedByPassId: string,
        payload: unknown,
        metadata: Readonly<Record<string, unknown>> = {},
      ) => this.artifacts.register(type, version, sessionId, producedByPassId, payload, [], metadata),
    };
  }

  private buildManifest<TInput>(sessionId: string, input: TInput, startedAt: string, completedAt: string) {
    return this.manifests.buildManifest({
      sessionId,
      compilerVersion: this.configuration.compilerVersion,
      pipelineVersion: this.configuration.pipelineVersion,
      passManifests: this.registry.list(),
      artifactIds: this.artifacts.list().map((artifact) => artifact.id),
      diagnostics: this.diagnostics.list(),
      startedAt,
      completedAt,
      sourceManifest: createSourceManifest(input),
      standards: this.configuration.standards,
    });
  }

  private buildResult(
    compilation: Compilation,
    sessionId: string,
    metrics: CompilerMetrics,
    telemetry: CompilerTelemetry,
    manifest: CompilerResult["manifest"],
  ): CompilerResult {
    const diagnostics = this.diagnostics.list();
    return Object.freeze({
      success: compilation.getStatus() === "completed" && !this.diagnostics.hasErrors(),
      status: compilation.getStatus(),
      warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "warning"),
      errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "fatal"),
      artifactsProduced: this.artifacts.list(),
      executionTime: metrics.snapshot().durationMs,
      compilerVersion: this.configuration.compilerVersion,
      pipelineVersion: this.configuration.pipelineVersion,
      metrics: metrics.snapshot(),
      diagnostics,
      telemetry: telemetry.snapshot(),
      outputs: compilation.snapshotOutputs(),
      compilationId: compilation.id,
      sessionId,
      manifest,
    });
  }

  private createFailureDiagnostic(error: unknown): CompilerDiagnostic {
    if (error instanceof CompilerException) {
      return {
        code: error.code,
        severity: error.severity,
        message: error.message,
        category: error.category,
        details: error.details,
      };
    }

    return {
      code: "COMPILATION_FAILED",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
      category: "execution",
    };
  }

  private applyDiagnosticMetrics(diagnostics: readonly CompilerDiagnostic[], metrics: CompilerMetrics): void {
    const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "fatal").length;
    if (warnings > 0) {
      metrics.incrementWarnings(warnings);
    }
    if (errors > 0) {
      metrics.incrementErrors(errors);
    }
  }

  private publishEvent(
    type: CompilerEventType,
    compilationId: string,
    sessionId: string,
    timestamp: string,
    passId: string | undefined,
    status: CompilerResult["status"],
    payload: Readonly<Record<string, unknown>>,
    metrics: CompilerMetrics,
    telemetry: CompilerTelemetry,
  ): void {
    if (!this.configuration.publishEvents) {
      return;
    }

    const event: CompilerEvent = Object.freeze({
      type,
      timestamp,
      compilationId,
      sessionId,
      passId,
      status,
      payload,
    });

    this.eventBus.publish(event);
    metrics.incrementEvents();
    telemetry.recordEvent(type, timestamp);
  }
}

function createSourceManifest<TInput>(input: TInput): { readonly sourceType: string; readonly sourceId: string } {
  if (input && typeof input === "object" && "source" in (input as Record<string, unknown>)) {
    const source = (input as { readonly source?: { readonly sourceType?: string; readonly id?: string } }).source;
    if (source) {
      return {
        sourceType: source.sourceType ?? "unknown",
        sourceId: source.id ?? "unknown",
      };
    }
  }

  return {
    sourceType: "unknown",
    sourceId: "unknown",
  };
}

function toStageCompletionEvent(kind: string | undefined, passId: string): CompilerEventType | undefined {
  if (kind === "verification") {
    return "VerificationCompleted";
  }
  if (kind === "generation" || passId.includes("generate")) {
    return "GenerationCompleted";
  }
  if (kind === "packaging") {
    return "PackagingCompleted";
  }
  if (kind === "certification") {
    return "CertificationCompleted";
  }

  return undefined;
}
