import type { KnowledgeArtifact } from "../discovery/KnowledgeArtifact";
import type { KnowledgeSource } from "../discovery/KnowledgeSource";
import type { EvidenceIR } from "../evidence/EvidenceIR";
import type { KnowledgeIR } from "../knowledge/KnowledgeIR";
import type { BusinessGenomeIR } from "../business-genome/BusinessGenomeIR";

export type CompilerStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "rolled-back";

export type CompilerDiagnosticSeverity = "info" | "warning" | "error" | "fatal";

export type CompilerDiagnosticCategory =
  | "configuration"
  | "dependency"
  | "execution"
  | "validation"
  | "verification"
  | "generation"
  | "packaging"
  | "certification"
  | "cancellation"
  | "system";

export interface CompilerSourceLocation {
  readonly filePath?: string;
  readonly line?: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}

export interface CompilerSuggestedFix {
  readonly description: string;
  readonly replacement?: string;
}

export interface CompilerDiagnosticCause {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly causes?: readonly CompilerDiagnosticCause[];
}

export interface CompilerDiagnostic {
  readonly code: string;
  readonly severity: CompilerDiagnosticSeverity;
  readonly message: string;
  readonly category?: CompilerDiagnosticCategory;
  readonly passId?: string;
  readonly artifactId?: string;
  readonly sourceLocation?: CompilerSourceLocation;
  readonly suggestedFixes?: readonly CompilerSuggestedFix[];
  readonly causes?: readonly CompilerDiagnosticCause[];
  readonly details?: Readonly<Record<string, unknown>>;
  readonly timestamp?: string;
}

export type CompilerSessionState =
  | "initialized"
  | "running"
  | "completed"
  | "failed"
  | "terminated"
  | "cancelled";

export type CompilerPassLifecycle = "active" | "deprecated" | "replaced";

export type CompilerPassKind =
  | "execution"
  | "validation"
  | "verification"
  | "generation"
  | "packaging"
  | "certification";

export interface CompilerPassMetadata {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly inputType: string;
  readonly outputType: string;
  readonly dependencies: readonly string[];
  readonly capabilities: readonly string[];
  readonly lifecycle: CompilerPassLifecycle;
  readonly replacedBy?: string;
  readonly kind?: CompilerPassKind;
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
}

export interface CompilerLoggerLike {
  debug(message: string, details?: Readonly<Record<string, unknown>>): void;
  info(message: string, details?: Readonly<Record<string, unknown>>): void;
  warn(message: string, details?: Readonly<Record<string, unknown>>): void;
  error(message: string, details?: Readonly<Record<string, unknown>>): void;
}

export interface CompilerEventBusLike {
  publish(event: CompilerEvent): void;
}

export interface CompilerConfiguration {
  readonly compilerVersion: string;
  readonly pipelineVersion: string;
  readonly stopOnError: boolean;
  readonly failOnValidationError: boolean;
  readonly collectMetrics: boolean;
  readonly publishEvents: boolean;
  readonly maxDiagnostics: number;
  readonly deterministicTimestamps: boolean;
  readonly standards: CompilerManifest["standards"];
}

export interface CompilerPassContext {
  readonly sessionId: string;
  readonly compilationId: string;
  readonly pipelineVersion: string;
  readonly configuration: CompilerConfiguration;
  readonly signal: { readonly cancelled: boolean; readonly reason?: string };
  readonly logger: CompilerLoggerLike;
  readonly eventBus: CompilerEventBusLike;
  readonly getOutput: <T>(passId: string) => T | undefined;
  readonly registerArtifact: (
    type: string,
    version: string,
    producedByPassId: string,
    payload: unknown,
    metadata?: Readonly<Record<string, unknown>>,
  ) => CompilerArtifact;
}

export interface CompilerPass<I, O> {
  readonly metadata: CompilerPassMetadata;
  execute(input: I, context: CompilerPassContext): Promise<O> | O;
  validate?(input: I, context: CompilerPassContext): Promise<readonly CompilerDiagnostic[]> | readonly CompilerDiagnostic[];
  rollback?(output: O | undefined, context: CompilerPassContext): Promise<void> | void;
}

export interface ValidationPass<I = unknown, O = unknown> extends CompilerPass<I, O> {
  readonly metadata: CompilerPassMetadata & { readonly kind: "validation" };
}

export interface VerificationPass<I = unknown, O = unknown> extends CompilerPass<I, O> {
  readonly metadata: CompilerPassMetadata & { readonly kind: "verification" };
}

export interface GenerationPass<I = unknown, O = unknown> extends CompilerPass<I, O> {
  readonly metadata: CompilerPassMetadata & { readonly kind: "generation" };
}

export interface PackagingPass<I = unknown, O = unknown> extends CompilerPass<I, O> {
  readonly metadata: CompilerPassMetadata & { readonly kind: "packaging" };
}

export interface CertificationPass<I = unknown, O = unknown> extends CompilerPass<I, O> {
  readonly metadata: CompilerPassMetadata & { readonly kind: "certification" };
}

export interface CompilerArtifact {
  readonly id: string;
  readonly type: string;
  readonly version: string;
  readonly checksum: string;
  readonly createdAt: string;
  readonly sessionId: string;
  readonly producedByPassId: string;
  readonly inputArtifactIds: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly payload?: unknown;
}

export interface CompilerMetricsSnapshot {
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs: number;
  readonly passCount: number;
  readonly completedPassCount: number;
  readonly failedPassCount: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly artifactCount: number;
  readonly rollbackCount: number;
  readonly eventCount: number;
}

export interface CompilerTelemetrySnapshot {
  readonly compilationId: string;
  readonly sessionId: string;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly passDurations: Readonly<Record<string, number>>;
  readonly timestamps: Readonly<Record<string, string>>;
}

export interface CompilerManifest {
  readonly schemaVersion: "1.0.0";
  readonly sessionId: string;
  readonly compilerVersion: string;
  readonly pipelineVersion: string;
  readonly passManifests: readonly CompilerPassMetadata[];
  readonly artifactIds: readonly string[];
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly checksum: string;
  readonly sourceManifest: {
    readonly sourceType: string;
    readonly sourceId: string;
  };
  readonly standards: {
    readonly gps0001: string;
    readonly gps0002: string;
    readonly eir0001: string;
    readonly bgs0001: string;
    readonly bgc0001: string;
    readonly gcc0001: string;
  };
}

export type CompilerEventType =
  | "CompilationStarted"
  | "CompilationCompleted"
  | "CompilationFailed"
  | "PassStarted"
  | "PassCompleted"
  | "PassFailed"
  | "ValidationStarted"
  | "ValidationCompleted"
  | "VerificationCompleted"
  | "GenerationCompleted"
  | "PackagingCompleted"
  | "CertificationCompleted";

export interface CompilerEvent<TPayload = Readonly<Record<string, unknown>>> {
  readonly type: CompilerEventType;
  readonly timestamp: string;
  readonly compilationId: string;
  readonly sessionId: string;
  readonly passId?: string;
  readonly status?: CompilerStatus;
  readonly payload: TPayload;
}

export interface CompilerExecutionPlanStep {
  readonly passId: string;
  readonly order: number;
  readonly dependencies: readonly string[];
  readonly kind: CompilerPassKind;
}

export interface CompilerResult {
  readonly success: boolean;
  readonly status: CompilerStatus;
  readonly warnings: readonly CompilerDiagnostic[];
  readonly errors: readonly CompilerDiagnostic[];
  readonly artifactsProduced: readonly CompilerArtifact[];
  readonly executionTime: number;
  readonly compilerVersion: string;
  readonly pipelineVersion: string;
  readonly metrics: CompilerMetricsSnapshot;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly telemetry: CompilerTelemetrySnapshot;
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly compilationId: string;
  readonly sessionId: string;
  readonly manifest: CompilerManifest;
}

export interface CompilerCoreInput {
  readonly source: KnowledgeSource;
}

export interface CompilerCoreOutput {
  readonly artifacts: readonly KnowledgeArtifact[];
  readonly evidenceIR: EvidenceIR;
  readonly knowledgeIR?: KnowledgeIR;
  readonly businessGenomeIR?: BusinessGenomeIR;
  readonly manifest: CompilerManifest;
}
