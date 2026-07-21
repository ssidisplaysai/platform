export const EVIDENCE_SCHEMA_VERSION = "1.0.0";
export class EvidenceValidationError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "EvidenceValidationError";
        this.code = code;
    }
}
