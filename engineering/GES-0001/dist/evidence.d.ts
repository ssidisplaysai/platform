import { EVIDENCE_SCHEMA_VERSION, type CanonicalEvidenceDraft, type CanonicalEvidenceRecord, type EvidenceContent, type EvidenceIdentity, type EvidenceIntegrity, type EvidenceMetadata, type EvidenceProvenance, type EvidenceRelationship, type EvidenceSource, type EvidenceStructure, type EvidenceVersion } from "./types.js";
type EvidencePayload = Omit<CanonicalEvidenceRecord, "integrity">;
export declare function deepFreeze<T>(value: T): T;
export declare class CanonicalEvidence {
    private readonly record;
    private constructor();
    static create(input: CanonicalEvidenceDraft): CanonicalEvidence;
    static fromJSON(value: unknown): CanonicalEvidence;
    get schemaVersion(): typeof EVIDENCE_SCHEMA_VERSION;
    get identity(): EvidenceIdentity;
    get source(): EvidenceSource;
    get metadata(): EvidenceMetadata;
    get content(): EvidenceContent;
    get structure(): EvidenceStructure;
    get provenance(): EvidenceProvenance;
    get integrity(): EvidenceIntegrity;
    get relationships(): readonly EvidenceRelationship[];
    get version(): EvidenceVersion;
    get checksum(): string;
    toJSON(): CanonicalEvidenceRecord;
    toString(): string;
}
export declare function createCanonicalEvidence(input: CanonicalEvidenceDraft): CanonicalEvidence;
export declare function parseCanonicalEvidence(value: unknown): CanonicalEvidence;
export declare function validateCanonicalEvidence(value: CanonicalEvidenceRecord): void;
export declare function computeCanonicalEvidenceChecksum(value: EvidencePayload): string;
export declare function canonicalEvidencePayload(value: CanonicalEvidenceRecord): EvidencePayload;
export {};
//# sourceMappingURL=evidence.d.ts.map