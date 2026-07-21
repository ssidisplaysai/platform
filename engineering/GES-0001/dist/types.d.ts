export declare const EVIDENCE_SCHEMA_VERSION: "1.0.0";
export type EvidenceSchemaVersion = typeof EVIDENCE_SCHEMA_VERSION;
export type EvidenceEncoding = "utf-8" | "base64";
export type EvidenceLifecycle = "draft" | "in-review" | "approved" | "frozen" | "archived";
export type EvidenceStructureKind = "flat" | "hierarchical" | "graph" | "table";
export type EvidenceIntegrityAlgorithm = "sha256";
export type EvidenceJsonPrimitive = string | number | boolean | null;
export interface EvidenceJsonRecord {
    readonly [key: string]: EvidenceJsonValue;
}
export type EvidenceJsonValue = EvidenceJsonPrimitive | readonly EvidenceJsonValue[] | EvidenceJsonRecord;
export interface EvidenceIdentity {
    readonly id: string;
    readonly namespace: string;
    readonly name: string;
    readonly category: string;
    readonly aliases: readonly string[];
}
export interface EvidenceSource {
    readonly system: string;
    readonly locator: string;
    readonly sourceType: string;
    readonly capturedAt: string;
    readonly origin?: string;
}
export interface EvidenceMetadata {
    readonly title: string;
    readonly description: string;
    readonly language: string;
    readonly tags: readonly string[];
    readonly properties: EvidenceJsonRecord;
    readonly createdAt: string;
    readonly updatedAt: string;
}
export interface EvidenceContent {
    readonly mediaType: string;
    readonly encoding: EvidenceEncoding;
    readonly summary: string;
    readonly payload: EvidenceJsonValue;
    readonly fingerprint?: string;
}
export interface EvidenceStructureNode {
    readonly id: string;
    readonly label: string;
    readonly kind: string;
    readonly parentId: string | null;
    readonly order: number;
    readonly attributes: EvidenceJsonRecord;
}
export interface EvidenceStructure {
    readonly kind: EvidenceStructureKind;
    readonly rootId: string;
    readonly nodes: readonly EvidenceStructureNode[];
}
export interface EvidenceProvenance {
    readonly collectedBy: string;
    readonly collectedAt: string;
    readonly derivedFrom: readonly string[];
    readonly transformationSteps: readonly string[];
    readonly sourceReferences: readonly string[];
}
export interface EvidenceIntegrity {
    readonly algorithm: EvidenceIntegrityAlgorithm;
    readonly checksum: string;
    readonly verified: boolean;
    readonly verifiedAt: string | null;
}
export interface EvidenceRelationship {
    readonly id: string;
    readonly type: string;
    readonly targetEvidenceId: string;
    readonly confidence: number;
    readonly metadata: EvidenceJsonRecord;
}
export interface EvidenceVersion {
    readonly version: string;
    readonly revision: number;
    readonly lifecycle: EvidenceLifecycle;
    readonly updatedAt: string;
}
export interface CanonicalEvidenceRecord {
    readonly schemaVersion: EvidenceSchemaVersion;
    readonly identity: EvidenceIdentity;
    readonly source: EvidenceSource;
    readonly metadata: EvidenceMetadata;
    readonly content: EvidenceContent;
    readonly structure: EvidenceStructure;
    readonly provenance: EvidenceProvenance;
    readonly integrity: EvidenceIntegrity;
    readonly relationships: readonly EvidenceRelationship[];
    readonly version: EvidenceVersion;
}
export interface CanonicalEvidenceDraft {
    readonly identity: EvidenceIdentity;
    readonly source: EvidenceSource;
    readonly metadata: EvidenceMetadata;
    readonly content: EvidenceContent;
    readonly structure: EvidenceStructure;
    readonly provenance: EvidenceProvenance;
    readonly relationships: readonly EvidenceRelationship[];
    readonly version: EvidenceVersion;
}
export type EvidenceValidationErrorCode = "INVALID_TYPE" | "INVALID_EMPTY_STRING" | "INVALID_IDENTIFIER" | "INVALID_TIMESTAMP" | "INVALID_JSON_VALUE" | "INVALID_CHECKSUM" | "INVALID_CONFIDENCE" | "INVALID_REVISION" | "INVALID_STRUCTURE" | "INVALID_RELATIONSHIP" | "INVALID_PROVENANCE" | "INVALID_VERSION" | "SCHEMA_VERSION_MISMATCH" | "CHECKSUM_MISMATCH" | "DUPLICATE_RELATIONSHIP_ID" | "DUPLICATE_STRUCTURE_NODE_ID" | "MISSING_STRUCTURE_ROOT";
export declare class EvidenceValidationError extends Error {
    readonly code: EvidenceValidationErrorCode;
    constructor(code: EvidenceValidationErrorCode, message: string);
}
//# sourceMappingURL=types.d.ts.map