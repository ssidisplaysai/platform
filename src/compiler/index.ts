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
export { CompilerSession } from "./core/CompilerSession";
export { CompilerContext } from "./core/CompilerContext";
export { CompilerPassRegistry } from "./core/CompilerPassRegistry";
export { CompilerPipeline } from "./core/CompilerPipeline";
export { CompilerArtifactManager } from "./core/CompilerArtifactManager";
export { CompilerManifestManager } from "./core/CompilerManifestManager";
export { CompilerDiagnosticsEngine } from "./core/CompilerDiagnosticsEngine";
export { CompilerValidationEngine } from "./core/CompilerValidationEngine";
export { CompilerVersionManager } from "./core/CompilerVersionManager";
export { DiscoveryCompilerPass } from "./core/passes/DiscoveryCompilerPass";
export { EvidenceCompilerPass } from "./core/passes/EvidenceCompilerPass";

export type {
	CompilerDiagnostic,
	CompilerCoreInput,
	CompilerCoreOutput,
	CompilerManifest,
	CompilerPass,
	CompilerPassMetadata,
	CompilerArtifact,
	CompilerSessionState,
} from "./core/types";
