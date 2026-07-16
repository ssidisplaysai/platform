export { DiscoveryEngine } from "./discovery/DiscoveryEngine";
export { DiscoveryCoordinator } from "./discovery/DiscoveryCoordinator";
export { DiscoveryJob } from "./discovery/DiscoveryJob";
export { DiscoveryRegistry } from "./discovery/DiscoveryRegistry";
export { DiscoveryError } from "./discovery/DiscoveryError";
export type { DiscoveryPlugin } from "./discovery/DiscoveryPlugin";
export type { KnowledgeSource, KnowledgeSourceType } from "./discovery/KnowledgeSource";
export type { KnowledgeArtifact, RawKnowledgeArtifact } from "./discovery/KnowledgeArtifact";
export type { KnowledgeVersion } from "./discovery/KnowledgeVersion";

export { ProvenanceEngine } from "./provenance/ProvenanceEngine";
export { Fingerprint } from "./provenance/Fingerprint";
export { SourceHash } from "./provenance/SourceHash";
export type { Lineage } from "./provenance/Lineage";

export { CanonicalNormalizer } from "./normalization/CanonicalNormalizer";
export { MetadataNormalizer } from "./normalization/MetadataNormalizer";
export { ContentNormalizer } from "./normalization/ContentNormalizer";

export type { EvidenceIR } from "./evidence/EvidenceIR";
export type { EvidenceNode } from "./evidence/EvidenceNode";
export type { EvidenceRelationship } from "./evidence/EvidenceRelationship";
export { EvidenceGraph } from "./evidence/EvidenceGraph";
export { EvidenceEmitter } from "./evidence/EvidenceEmitter";
export { EvidenceValidator, EvidenceValidationError } from "./evidence/EvidenceValidator";
export { EvidenceGraphQuery } from "./evidence/EvidenceGraphQuery";
export { EvidenceGraphMerger, EvidenceMergeError } from "./evidence/EvidenceGraphMerger";
export { EvidenceGraphHasher } from "./evidence/EvidenceGraphHasher";
export { EvidenceGraphTransform } from "./evidence/EvidenceGraphTransform";

export type { KnowledgeIR } from "./knowledge/KnowledgeIR";
export type { KnowledgeNode } from "./knowledge/KnowledgeNode";
export type { KnowledgeRelationship } from "./knowledge/KnowledgeRelationship";
export type { KnowledgeClaim } from "./knowledge/KnowledgeClaim";
export { KnowledgeGraph } from "./knowledge/KnowledgeGraph";
export { KnowledgeCompiler } from "./knowledge/KnowledgeCompiler";
export { KnowledgeValidator, KnowledgeValidationError } from "./knowledge/KnowledgeValidator";
export { KnowledgeGraphHasher } from "./knowledge/KnowledgeGraphHasher";
export { KnowledgeGraphQuery } from "./knowledge/KnowledgeGraphQuery";

export { MarkdownDiscoveryPlugin } from "./plugins/markdown/MarkdownDiscoveryPlugin";
export { JsonDiscoveryPlugin } from "./plugins/json/JsonDiscoveryPlugin";
export { YamlDiscoveryPlugin } from "./plugins/yaml/YamlDiscoveryPlugin";
export { FilesystemDiscoveryPlugin } from "./plugins/filesystem/FilesystemDiscoveryPlugin";

export { CompilerCore } from "./core/CompilerCore";
export { CompilerKernel } from "./core/CompilerKernel";
export { CompilerSession } from "./core/CompilerSession";
export { CompilerContext } from "./core/CompilerContext";
export { CompilerPassRegistry } from "./core/CompilerPassRegistry";
export { CompilerPipeline } from "./core/CompilerPipeline";
export { CompilerPipelineBuilder } from "./core/CompilerPipelineBuilder";
export { Compilation } from "./core/Compilation";
export { CompilationTransaction } from "./core/CompilationTransaction";
export { CompilerExecutionPlan } from "./core/CompilerExecutionPlan";
export { CompilerArtifactManager } from "./core/CompilerArtifactManager";
export { ArtifactRegistry } from "./core/ArtifactRegistry";
export { IRRegistry } from "./core/IRRegistry";
export { ValidatorRegistry } from "./core/ValidatorRegistry";
export { GeneratorRegistry } from "./core/GeneratorRegistry";
export { ExtensionRegistry } from "./core/ExtensionRegistry";
export { CompilerManifestManager } from "./core/CompilerManifestManager";
export { CompilerDiagnosticsEngine } from "./core/CompilerDiagnosticsEngine";
export { CompilerDiagnostics } from "./core/CompilerDiagnostics";
export { CompilerValidationEngine } from "./core/CompilerValidationEngine";
export { CompilerVersionManager } from "./core/CompilerVersionManager";
export { CompilerLogger } from "./core/CompilerLogger";
export { CompilerEventBus } from "./core/CompilerEventBus";
export { CompilerMetrics } from "./core/CompilerMetrics";
export { CompilerTelemetry } from "./core/CompilerTelemetry";
export { CompilerError } from "./core/CompilerError";
export { CompilerWarning } from "./core/CompilerWarning";
export { CompilerException } from "./core/CompilerException";
export { CompilerCancellation } from "./core/CompilerCancellation";
export { createCompilerConfiguration, DEFAULT_COMPILER_CONFIGURATION } from "./core/CompilerConfiguration";
export { DiscoveryCompilerPass } from "./core/passes/DiscoveryCompilerPass";
export { EvidenceCompilerPass } from "./core/passes/EvidenceCompilerPass";
export { KnowledgeCompilerPass } from "./core/passes/KnowledgeCompilerPass";
export { BusinessGenomeCompilerPass } from "./core/passes/BusinessGenomeCompilerPass";
export {
	BUSINESS_GENOME_SEMANTIC_CLASSES,
	BUSINESS_GENOME_RELATIONSHIP_CLASSES,
	RELATIONSHIP_CLASS_GOVERNANCE_NOTE,
	BusinessGenomeCompiler,
	BusinessGenomePassRegistry,
	InputValidationPass,
	CanonicalVerificationPass,
	EvidenceGroupingPass,
	BGC_DIAGNOSTIC_CODES,
	createDiagnostic,
	sortDiagnostics,
	BGC_ARCHITECTURAL_PASS_ORDER,
	deterministicIdentity,
	createInitialPipelineState,
	updatePassHistory,
	isBusinessGenomeSemanticClass,
	isBusinessGenomeRelationshipClass,
	toDeterministicSemanticGraph,
	deterministicSemanticGraphSerialization,
	checksumBusinessGenomeArtifact,
} from "./genome";

export type {
	CompilerConfiguration,
	CompilerDiagnostic,
	CompilerEvent,
	CompilerCoreInput,
	CompilerCoreOutput,
	CompilerExecutionPlanStep,
	CompilerManifest,
	CompilerMetricsSnapshot,
	CompilerPass,
	CompilerPassContext,
	CompilerPassKind,
	CompilerPassMetadata,
	CompilerArtifact,
	CompilerResult,
	CompilerStatus,
	CompilerTelemetrySnapshot,
	ValidationPass,
	VerificationPass,
	GenerationPass,
	PackagingPass,
	CertificationPass,
	CompilerSessionState,
} from "./core/types";

export type {
	BusinessGenomeSemanticClass,
	BusinessGenomeRelationshipClass,
	SemanticCertaintyState,
	SemanticCertainty,
	SemanticConflictContext,
	SemanticValidationStatus,
	SemanticVersionContext,
	SemanticProvenance,
	SemanticObject,
	SemanticRelationship,
	SemanticGraph,
	BusinessGenomeArtifact,
	BusinessGenomeCompilerInput,
	BusinessGenomeCompilationStatus,
	BusinessGenomeIntermediateCompilation,
	BusinessGenomeCompilerOutput,
	BusinessGenomePassId,
	BusinessGenomePipelineState,
	ValidatedEvidenceReference,
	ValidatedEvidenceIRView,
	CanonicalEvidenceAttestation,
	GroupedEvidenceSet,
	GroupedEvidenceCollection,
	BusinessGenomePassResult,
} from "./genome";
