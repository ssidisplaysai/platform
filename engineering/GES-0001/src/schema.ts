import { EVIDENCE_SCHEMA_VERSION } from "./types.js";

export type JsonSchema = Record<string, unknown>;

export function generateCanonicalEvidenceSchema(): JsonSchema {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://genesis.local/schemas/canonical-evidence.schema.json",
    title: "Canonical Evidence Model",
    type: "object",
    additionalProperties: false,
    required: [
      "schemaVersion",
      "identity",
      "source",
      "metadata",
      "content",
      "structure",
      "provenance",
      "integrity",
      "relationships",
      "version",
    ],
    properties: {
      schemaVersion: { const: EVIDENCE_SCHEMA_VERSION },
      identity: { $ref: "#/$defs/identity" },
      source: { $ref: "#/$defs/source" },
      metadata: { $ref: "#/$defs/metadata" },
      content: { $ref: "#/$defs/content" },
      structure: { $ref: "#/$defs/structure" },
      provenance: { $ref: "#/$defs/provenance" },
      integrity: { $ref: "#/$defs/integrity" },
      relationships: { type: "array", items: { $ref: "#/$defs/relationship" } },
      version: { $ref: "#/$defs/version" },
    },
    $defs: {
      jsonValue: {
        anyOf: [
          { type: "string" },
          { type: "number" },
          { type: "boolean" },
          { type: "null" },
          { type: "array", items: { $ref: "#/$defs/jsonValue" } },
          { type: "object", additionalProperties: { $ref: "#/$defs/jsonValue" } },
        ],
      },
      identity: {
        type: "object",
        additionalProperties: false,
        required: ["id", "namespace", "name", "category", "aliases"],
        properties: {
          id: { type: "string", minLength: 1 },
          namespace: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          category: { type: "string", minLength: 1 },
          aliases: { type: "array", items: { type: "string", minLength: 1 } },
        },
      },
      source: {
        type: "object",
        additionalProperties: false,
        required: ["system", "locator", "sourceType", "capturedAt"],
        properties: {
          system: { type: "string", minLength: 1 },
          locator: { type: "string", minLength: 1 },
          sourceType: { type: "string", minLength: 1 },
          capturedAt: { type: "string", format: "date-time" },
          origin: { type: "string", minLength: 1 },
        },
      },
      metadata: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "language", "tags", "properties", "createdAt", "updatedAt"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          language: { type: "string", minLength: 1 },
          tags: { type: "array", items: { type: "string", minLength: 1 } },
          properties: { type: "object", additionalProperties: { $ref: "#/$defs/jsonValue" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      content: {
        type: "object",
        additionalProperties: false,
        required: ["mediaType", "encoding", "summary", "payload"],
        properties: {
          mediaType: { type: "string", minLength: 1 },
          encoding: { enum: ["utf-8", "base64"] },
          summary: { type: "string", minLength: 1 },
          payload: { $ref: "#/$defs/jsonValue" },
          fingerprint: { type: "string", pattern: "^[A-Fa-f0-9]{64}$" },
        },
      },
      structureNode: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "kind", "parentId", "order", "attributes"],
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          kind: { type: "string", minLength: 1 },
          parentId: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
          order: { type: "integer", minimum: 0 },
          attributes: { type: "object", additionalProperties: { $ref: "#/$defs/jsonValue" } },
        },
      },
      structure: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "rootId", "nodes"],
        properties: {
          kind: { enum: ["flat", "hierarchical", "graph", "table"] },
          rootId: { type: "string", minLength: 1 },
          nodes: { type: "array", items: { $ref: "#/$defs/structureNode" } },
        },
      },
      provenance: {
        type: "object",
        additionalProperties: false,
        required: ["collectedBy", "collectedAt", "derivedFrom", "transformationSteps", "sourceReferences"],
        properties: {
          collectedBy: { type: "string", minLength: 1 },
          collectedAt: { type: "string", format: "date-time" },
          derivedFrom: { type: "array", items: { type: "string", minLength: 1 } },
          transformationSteps: { type: "array", items: { type: "string", minLength: 1 } },
          sourceReferences: { type: "array", items: { type: "string", minLength: 1 } },
        },
      },
      integrity: {
        type: "object",
        additionalProperties: false,
        required: ["algorithm", "checksum", "verified", "verifiedAt"],
        properties: {
          algorithm: { const: "sha256" },
          checksum: { type: "string", pattern: "^[A-Fa-f0-9]{64}$" },
          verified: { type: "boolean" },
          verifiedAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
        },
      },
      relationship: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "targetEvidenceId", "confidence", "metadata"],
        properties: {
          id: { type: "string", minLength: 1 },
          type: { type: "string", minLength: 1 },
          targetEvidenceId: { type: "string", minLength: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          metadata: { type: "object", additionalProperties: { $ref: "#/$defs/jsonValue" } },
        },
      },
      version: {
        type: "object",
        additionalProperties: false,
        required: ["version", "revision", "lifecycle", "updatedAt"],
        properties: {
          version: { type: "string", minLength: 1 },
          revision: { type: "integer", minimum: 0 },
          lifecycle: { enum: ["draft", "in-review", "approved", "frozen", "archived"] },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  };
}