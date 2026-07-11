import type { KnowledgeSource } from "../discovery/KnowledgeSource";
import type { KnowledgeArtifact } from "../discovery/KnowledgeArtifact";
import type { EvidenceIR } from "../evidence/EvidenceIR";

export type CompilerDiagnosticSeverity = "error" | "warning" | "info";

export interface CompilerDiagnostic {
  code: string;
  severity: CompilerDiagnosticSeverity;
  message: string;
  passId?: string;
  artifactId?: string;
  details?: Record<string, unknown>;
}

export type CompilerSessionState =
  | "initialized"
  | "running"
  | "completed"
  | "failed"
  | "terminated";

export type CompilerPassLifecycle = "active" | "deprecated" | "replaced";

export interface CompilerPassMetadata {
  id: string;
  version: string;
  description: string;
  inputType: string;
  outputType: string;
  dependencies: string[];
  capabilities: string[];
  lifecycle: CompilerPassLifecycle;
  replacedBy?: string;
}

export interface CompilerPassContext {
  sessionId: string;
  pipelineVersion: string;
}

export interface CompilerPass<I, O> {
  readonly metadata: CompilerPassMetadata;
  execute(input: I, context: CompilerPassContext): Promise<O> | O;
}

export interface CompilerArtifact {
  id: string;
  type: string;
  version: string;
  checksum: string;
  createdAt: string;
  sessionId: string;
  producedByPassId: string;
  inputArtifactIds: string[];
  metadata: Record<string, unknown>;
}

export interface CompilerManifest {
  schemaVersion: "1.0.0";
  sessionId: string;
  compilerVersion: string;
  pipelineVersion: string;
  passManifests: CompilerPassMetadata[];
  artifactIds: string[];
  diagnostics: CompilerDiagnostic[];
  startedAt: string;
  completedAt: string;
  checksum: string;
  sourceManifest: {
    sourceType: string;
    sourceId: string;
  };
  standards: {
    gps0001: string;
    gps0002: string;
    eir0001: string;
    bgs0001: string;
    bgc0001: string;
    gcc0001: string;
  };
}

export interface CompilerCoreInput {
  source: KnowledgeSource;
}

export interface CompilerCoreOutput {
  artifacts: KnowledgeArtifact[];
  evidenceIR: EvidenceIR;
  manifest: CompilerManifest;
}
