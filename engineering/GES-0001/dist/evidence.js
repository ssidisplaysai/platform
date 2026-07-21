import { createHash } from "node:crypto";
import { EVIDENCE_SCHEMA_VERSION, EvidenceValidationError, } from "./types.js";
const VALID_STRUCTURE_KINDS = ["flat", "hierarchical", "graph", "table"];
const VALID_LIFECYCLE_STATES = ["draft", "in-review", "approved", "frozen", "archived"];
function compareDeterministicStrings(left, right) {
    if (left === right) {
        return 0;
    }
    return left < right ? -1 : 1;
}
function fail(code, message) {
    throw new EvidenceValidationError(code, message);
}
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isJsonValue(value) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every((entry) => isJsonValue(entry));
    }
    if (isObject(value)) {
        return Object.values(value).every((entry) => isJsonValue(entry));
    }
    return false;
}
function assertString(value, field) {
    if (typeof value !== "string") {
        fail("INVALID_TYPE", `${field} must be a string`);
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        fail("INVALID_EMPTY_STRING", `${field} must not be empty`);
    }
    return trimmed;
}
function assertOptionalString(value, field) {
    if (value === undefined) {
        return undefined;
    }
    return assertString(value, field);
}
function assertIdentifier(value, field) {
    const identifier = assertString(value, field);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(identifier)) {
        fail("INVALID_IDENTIFIER", `${field} contains unsupported characters`);
    }
    return identifier;
}
function assertTimestamp(value, field) {
    const timestamp = assertString(value, field);
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed)) {
        fail("INVALID_TIMESTAMP", `${field} is not a valid ISO timestamp`);
    }
    return new Date(parsed).toISOString();
}
function assertArray(value, field) {
    if (!Array.isArray(value)) {
        fail("INVALID_TYPE", `${field} must be an array`);
    }
    return value;
}
function assertJsonRecord(value, field) {
    if (!isObject(value)) {
        fail("INVALID_TYPE", `${field} must be an object`);
    }
    for (const [key, entry] of Object.entries(value)) {
        if (!isJsonValue(entry)) {
            fail("INVALID_JSON_VALUE", `${field}.${key} must be JSON-compatible`);
        }
    }
    return value;
}
function normalizeStringArray(values, field) {
    const normalized = values.map((value, index) => assertString(value, `${field}[${index}]`));
    return Object.freeze([...new Set(normalized)].sort(compareDeterministicStrings));
}
function assertEncoding(value) {
    if (typeof value === "string" && (value === "utf-8" || value === "base64")) {
        return value;
    }
    fail("INVALID_TYPE", "content.encoding must be utf-8 or base64");
}
function assertLifecycle(value) {
    if (typeof value === "string" && VALID_LIFECYCLE_STATES.includes(value)) {
        return value;
    }
    fail("INVALID_VERSION", "version.lifecycle must be a supported lifecycle state");
}
function assertStructureKind(value) {
    if (typeof value === "string" && VALID_STRUCTURE_KINDS.includes(value)) {
        return value;
    }
    fail("INVALID_STRUCTURE", "structure.kind must be a supported structure kind");
}
function stableSerialize(value) {
    if (value === null) {
        return "null";
    }
    if (typeof value === "string") {
        return JSON.stringify(value);
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : "null";
    }
    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }
    if (Array.isArray(value)) {
        return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
    }
    if (isObject(value)) {
        const entries = Object.entries(value).sort((left, right) => compareDeterministicStrings(left[0], right[0]));
        const serializedEntries = entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`);
        return `{${serializedEntries.join(",")}}`;
    }
    return "null";
}
function sha256(value) {
    return createHash("sha256").update(stableSerialize(value)).digest("hex");
}
export function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) {
            deepFreeze(child);
        }
    }
    return value;
}
function normalizeIdentity(input) {
    return {
        id: assertIdentifier(input.id, "identity.id"),
        namespace: assertIdentifier(input.namespace, "identity.namespace"),
        name: assertString(input.name, "identity.name"),
        category: assertString(input.category, "identity.category"),
        aliases: normalizeStringArray(input.aliases, "identity.aliases"),
    };
}
function normalizeSource(input) {
    const source = {
        system: assertString(input.system, "source.system"),
        locator: assertString(input.locator, "source.locator"),
        sourceType: assertString(input.sourceType, "source.sourceType"),
        capturedAt: assertTimestamp(input.capturedAt, "source.capturedAt"),
    };
    const origin = assertOptionalString(input.origin, "source.origin");
    if (origin !== undefined) {
        return { ...source, origin };
    }
    return source;
}
function normalizeMetadata(input) {
    const createdAt = assertTimestamp(input.createdAt, "metadata.createdAt");
    const updatedAt = assertTimestamp(input.updatedAt, "metadata.updatedAt");
    if (Date.parse(updatedAt) < Date.parse(createdAt)) {
        fail("INVALID_TIMESTAMP", "metadata.updatedAt cannot be earlier than metadata.createdAt");
    }
    return {
        title: assertString(input.title, "metadata.title"),
        description: assertString(input.description, "metadata.description"),
        language: assertString(input.language, "metadata.language"),
        tags: normalizeStringArray(input.tags, "metadata.tags"),
        properties: assertJsonRecord(input.properties, "metadata.properties"),
        createdAt,
        updatedAt,
    };
}
function normalizeContent(input) {
    const fingerprint = assertOptionalString(input.fingerprint, "content.fingerprint");
    if (fingerprint !== undefined && !/^[A-Fa-f0-9]{64}$/.test(fingerprint)) {
        fail("INVALID_CHECKSUM", "content.fingerprint must be a 64-character hex digest");
    }
    const content = {
        mediaType: assertString(input.mediaType, "content.mediaType"),
        encoding: assertEncoding(input.encoding),
        summary: assertString(input.summary, "content.summary"),
        payload: input.payload,
    };
    if (fingerprint !== undefined) {
        return { ...content, fingerprint };
    }
    return content;
}
function normalizeStructureNode(input) {
    return {
        id: assertIdentifier(input.id, "structure.nodes.id"),
        label: assertString(input.label, "structure.nodes.label"),
        kind: assertString(input.kind, "structure.nodes.kind"),
        parentId: input.parentId === null ? null : assertIdentifier(input.parentId, "structure.nodes.parentId"),
        order: Number.isInteger(input.order) && input.order >= 0 ? input.order : fail("INVALID_STRUCTURE", "structure.nodes.order must be a non-negative integer"),
        attributes: assertJsonRecord(input.attributes, "structure.nodes.attributes"),
    };
}
function normalizeStructure(input) {
    const kind = assertStructureKind(input.kind);
    const rootId = assertIdentifier(input.rootId, "structure.rootId");
    const nodes = input.nodes.map((node) => normalizeStructureNode(node));
    const nodeIds = new Set();
    for (const node of nodes) {
        if (nodeIds.has(node.id)) {
            fail("DUPLICATE_STRUCTURE_NODE_ID", `Duplicate structure node id: ${node.id}`);
        }
        nodeIds.add(node.id);
    }
    const rootNode = nodes.find((node) => node.id === rootId);
    if (!rootNode) {
        fail("MISSING_STRUCTURE_ROOT", "structure.rootId must reference a node id");
    }
    if (rootNode.parentId !== null) {
        fail("INVALID_STRUCTURE", "structure root node must not have a parentId");
    }
    for (const node of nodes) {
        if (node.parentId !== null && !nodeIds.has(node.parentId)) {
            fail("INVALID_STRUCTURE", `structure node parentId does not exist: ${node.parentId}`);
        }
    }
    const sortedNodes = [...nodes].sort((left, right) => {
        const orderCompare = left.order - right.order;
        if (orderCompare !== 0) {
            return orderCompare;
        }
        return compareDeterministicStrings(left.id, right.id);
    });
    return {
        kind,
        rootId,
        nodes: Object.freeze(sortedNodes),
    };
}
function normalizeProvenance(input) {
    const transformationSteps = input.transformationSteps.map((step, index) => assertString(step, `provenance.transformationSteps[${index}]`));
    if (transformationSteps.length === 0) {
        fail("INVALID_PROVENANCE", "provenance.transformationSteps must not be empty");
    }
    return {
        collectedBy: assertString(input.collectedBy, "provenance.collectedBy"),
        collectedAt: assertTimestamp(input.collectedAt, "provenance.collectedAt"),
        derivedFrom: normalizeStringArray(input.derivedFrom, "provenance.derivedFrom"),
        transformationSteps: Object.freeze([...transformationSteps]),
        sourceReferences: normalizeStringArray(input.sourceReferences, "provenance.sourceReferences"),
    };
}
function normalizeRelationship(input) {
    return {
        id: assertIdentifier(input.id, "relationships.id"),
        type: assertString(input.type, "relationships.type"),
        targetEvidenceId: assertIdentifier(input.targetEvidenceId, "relationships.targetEvidenceId"),
        confidence: Number.isFinite(input.confidence) && input.confidence >= 0 && input.confidence <= 1 ? input.confidence : fail("INVALID_CONFIDENCE", "relationships.confidence must be between 0 and 1"),
        metadata: assertJsonRecord(input.metadata, "relationships.metadata"),
    };
}
function normalizeVersion(input) {
    return {
        version: assertString(input.version, "version.version"),
        revision: Number.isInteger(input.revision) && input.revision >= 0 ? input.revision : fail("INVALID_REVISION", "version.revision must be a non-negative integer"),
        lifecycle: assertLifecycle(input.lifecycle),
        updatedAt: assertTimestamp(input.updatedAt, "version.updatedAt"),
    };
}
function normalizeDraft(input) {
    const identity = normalizeIdentity(input.identity);
    const source = normalizeSource(input.source);
    const metadata = normalizeMetadata(input.metadata);
    const content = normalizeContent(input.content);
    const structure = normalizeStructure(input.structure);
    const provenance = normalizeProvenance(input.provenance);
    const relationships = input.relationships.map((relationship) => normalizeRelationship(relationship));
    const version = normalizeVersion(input.version);
    const relationshipIds = new Set();
    for (const relationship of relationships) {
        if (relationshipIds.has(relationship.id)) {
            fail("DUPLICATE_RELATIONSHIP_ID", `Duplicate relationship id: ${relationship.id}`);
        }
        relationshipIds.add(relationship.id);
    }
    return deepFreeze({
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
        identity,
        source,
        metadata,
        content,
        structure,
        provenance,
        relationships: Object.freeze([...relationships].sort((left, right) => compareDeterministicStrings(left.id, right.id))),
        version,
    });
}
function normalizeIntegrity(record, providedIntegrity) {
    const checksum = sha256(record);
    const verifiedAt = providedIntegrity?.verifiedAt === undefined
        ? record.version.updatedAt
        : providedIntegrity.verifiedAt === null
            ? null
            : assertTimestamp(providedIntegrity.verifiedAt, "integrity.verifiedAt");
    return {
        algorithm: "sha256",
        checksum,
        verified: providedIntegrity?.verified ?? true,
        verifiedAt,
    };
}
function validateIntegrity(record, integrity) {
    if (integrity.algorithm !== "sha256") {
        fail("INVALID_CHECKSUM", "integrity.algorithm must be sha256");
    }
    if (!/^[A-Fa-f0-9]{64}$/.test(integrity.checksum)) {
        fail("INVALID_CHECKSUM", "integrity.checksum must be a 64-character hex digest");
    }
    const expected = sha256(record);
    if (expected !== integrity.checksum) {
        fail("CHECKSUM_MISMATCH", "integrity.checksum does not match canonical payload");
    }
    if (integrity.verifiedAt !== null) {
        assertTimestamp(integrity.verifiedAt, "integrity.verifiedAt");
    }
}
function validateRecord(record) {
    if (record.schemaVersion !== EVIDENCE_SCHEMA_VERSION) {
        fail("SCHEMA_VERSION_MISMATCH", `schemaVersion must be ${EVIDENCE_SCHEMA_VERSION}`);
    }
    validateIntegrity({
        schemaVersion: record.schemaVersion,
        identity: record.identity,
        source: record.source,
        metadata: record.metadata,
        content: record.content,
        structure: record.structure,
        provenance: record.provenance,
        relationships: record.relationships,
        version: record.version,
    }, record.integrity);
}
function cloneRecord(record) {
    return JSON.parse(stableSerialize(record));
}
export class CanonicalEvidence {
    record;
    constructor(record) {
        this.record = deepFreeze(record);
        Object.freeze(this);
    }
    static create(input) {
        const payload = normalizeDraft(input);
        const integrity = normalizeIntegrity(payload, { verified: true, verifiedAt: payload.version.updatedAt });
        const record = deepFreeze({ ...payload, integrity });
        validateRecord(record);
        return new CanonicalEvidence(record);
    }
    static fromJSON(value) {
        if (!isObject(value)) {
            fail("INVALID_TYPE", "Canonical evidence must be a JSON object");
        }
        if (value.schemaVersion !== EVIDENCE_SCHEMA_VERSION) {
            fail("SCHEMA_VERSION_MISMATCH", `schemaVersion must be ${EVIDENCE_SCHEMA_VERSION}`);
        }
        const relationships = assertArray(value.relationships, "relationships");
        const integrity = value.integrity;
        if (!integrity || !isObject(integrity)) {
            fail("INVALID_TYPE", "integrity is required");
        }
        const payload = normalizeDraft({
            identity: value.identity,
            source: value.source,
            metadata: value.metadata,
            content: value.content,
            structure: value.structure,
            provenance: value.provenance,
            relationships,
            version: value.version,
        });
        const parsedIntegrity = integrity;
        validateIntegrity(payload, parsedIntegrity);
        const record = deepFreeze({ ...payload, integrity: parsedIntegrity });
        validateRecord(record);
        return new CanonicalEvidence(record);
    }
    get schemaVersion() {
        return this.record.schemaVersion;
    }
    get identity() {
        return this.record.identity;
    }
    get source() {
        return this.record.source;
    }
    get metadata() {
        return this.record.metadata;
    }
    get content() {
        return this.record.content;
    }
    get structure() {
        return this.record.structure;
    }
    get provenance() {
        return this.record.provenance;
    }
    get integrity() {
        return this.record.integrity;
    }
    get relationships() {
        return this.record.relationships;
    }
    get version() {
        return this.record.version;
    }
    get checksum() {
        return this.record.integrity.checksum;
    }
    toJSON() {
        return cloneRecord(this.record);
    }
    toString() {
        return stableSerialize(this.record);
    }
}
export function createCanonicalEvidence(input) {
    return CanonicalEvidence.create(input);
}
export function parseCanonicalEvidence(value) {
    return CanonicalEvidence.fromJSON(value);
}
export function validateCanonicalEvidence(value) {
    validateRecord(value);
}
export function computeCanonicalEvidenceChecksum(value) {
    return sha256(value);
}
export function canonicalEvidencePayload(value) {
    return {
        schemaVersion: value.schemaVersion,
        identity: value.identity,
        source: value.source,
        metadata: value.metadata,
        content: value.content,
        structure: value.structure,
        provenance: value.provenance,
        relationships: value.relationships,
        version: value.version,
    };
}
