import assert from "node:assert/strict";
import test from "node:test";

import {
  CanonicalEvidence,
  EVIDENCE_SCHEMA_VERSION,
  EvidenceValidationError,
  canonicalEvidencePayload,
  computeCanonicalEvidenceChecksum,
  createCanonicalEvidence,
  deepFreeze,
  generateCanonicalEvidenceSchema,
  parseCanonicalEvidence,
} from "../src/index.js";

function createFixture() {
  return {
    identity: {
      id: "evidence-001",
      namespace: "genesis",
      name: "design-note",
      category: "specification",
      aliases: ["design-note", "design-note-v1"],
    },
    source: {
      system: "docs",
      locator: "engineering/GES-0001/README.md",
      sourceType: "markdown",
      capturedAt: "2026-07-21T00:00:00Z",
      origin: "repository",
    },
    metadata: {
      title: "Canonical Evidence Model",
      description: "Production evidence record for GES-0001",
      language: "en",
      tags: ["canonical", "evidence", "ges-0001"],
      properties: {
        owner: "platform-team",
        priority: 1,
      },
      createdAt: "2026-07-21T00:00:00Z",
      updatedAt: "2026-07-21T00:00:00Z",
    },
    content: {
      mediaType: "application/json",
      encoding: "utf-8" as const,
      summary: "Canonical evidence payload",
      payload: {
        claim: "evidence is canonical",
        sections: ["identity", "source", "metadata"],
      },
      fingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
    structure: {
      kind: "hierarchical" as const,
      rootId: "root",
      nodes: [
        {
          id: "root",
          label: "Evidence",
          kind: "section",
          parentId: null,
          order: 0,
          attributes: {},
        },
        {
          id: "metadata",
          label: "Metadata",
          kind: "section",
          parentId: "root",
          order: 1,
          attributes: { emphasis: "high" },
        },
      ],
    },
    provenance: {
      collectedBy: "system",
      collectedAt: "2026-07-21T00:00:00Z",
      derivedFrom: ["source-a", "source-b"],
      transformationSteps: ["capture", "normalize", "validate"],
      sourceReferences: ["README.md"],
    },
    relationships: [
      {
        id: "rel-001",
        type: "references",
        targetEvidenceId: "evidence-002",
        confidence: 1,
        metadata: { note: "reference to companion evidence" },
      },
    ],
    version: {
      version: "1.0.0",
      revision: 1,
      lifecycle: "draft" as const,
      updatedAt: "2026-07-21T00:00:00Z",
    },
  };
}

test("creates a frozen canonical evidence record with deterministic checksum", () => {
  const first = createCanonicalEvidence(createFixture());
  const second = createCanonicalEvidence(createFixture());

  assert.equal(first.schemaVersion, EVIDENCE_SCHEMA_VERSION);
  assert.equal(first.checksum, second.checksum);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.identity), true);
  assert.equal(Object.isFrozen(first.relationships), true);
  assert.equal(Object.isFrozen(first.metadata.tags), true);
  assert.equal(Object.isFrozen(first.metadata.properties), true);
});

test("serializes and deserializes without loss", () => {
  const original = createCanonicalEvidence(createFixture());
  const roundTrip = parseCanonicalEvidence(original.toJSON());

  assert.equal(roundTrip.checksum, original.checksum);
  assert.deepEqual(roundTrip.toJSON(), original.toJSON());
});

test("rejects checksum tampering", () => {
  const original = createCanonicalEvidence(createFixture());
  const json = original.toJSON() as unknown as Record<string, unknown>;
  const integrity = json.integrity as Record<string, unknown>;

  json.integrity = {
    ...integrity,
    checksum: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  };

  assert.throws(() => parseCanonicalEvidence(json), EvidenceValidationError);
});

test("rejects invalid timestamps and duplicate relationship ids", () => {
  const invalidTimestamp = createFixture();
  invalidTimestamp.metadata.createdAt = "not-a-date";

  assert.throws(() => createCanonicalEvidence(invalidTimestamp), EvidenceValidationError);

  const duplicateRelationships = createFixture();
  const relationship = duplicateRelationships.relationships[0]!;
  duplicateRelationships.relationships = [
    relationship,
    relationship,
  ];

  assert.throws(() => createCanonicalEvidence(duplicateRelationships), EvidenceValidationError);
});

test("supports stable serialization, checksum calculation, and mutation resistance", () => {
  const fixture = createFixture();
  const evidence = createCanonicalEvidence(fixture);
  const canonicalSnapshot = evidence.toJSON();
  const snapshot = evidence.toJSON() as unknown as { metadata: { tags: string[] } };

  assert.equal(evidence.toString(), createCanonicalEvidence(fixture).toString());
  assert.equal(computeCanonicalEvidenceChecksum(canonicalEvidencePayload(canonicalSnapshot)), evidence.checksum);

  const originalName = evidence.identity.name;
  assert.throws(() => {
    (evidence.identity as { name: string }).name = "mutated";
  });
  assert.equal(evidence.identity.name, originalName);

  snapshot.metadata.tags = [...snapshot.metadata.tags, "mutated"];
  assert.notEqual(snapshot.metadata.tags.length, evidence.metadata.tags.length);

  assert.equal(Object.isFrozen(deepFreeze({ a: { b: [1, 2, 3] } })), true);
});

test("accepts optional fields and boundary values", () => {
  const base = createFixture();
  const { origin, ...source } = base.source;
  const { fingerprint, ...content } = base.content;
  void origin;
  void fingerprint;

  const evidence = createCanonicalEvidence({
    ...base,
    source,
    content,
  });
  const serialized = evidence.toJSON();

  assert.equal(serialized.source.origin, undefined);
  assert.equal(serialized.content.fingerprint, undefined);
  assert.equal(serialized.integrity.verifiedAt, "2026-07-21T00:00:00.000Z");

  const parsed = parseCanonicalEvidence({
    ...serialized,
    integrity: { ...serialized.integrity, verifiedAt: null },
  });

  assert.equal(parsed.integrity.verifiedAt, null);
});

test("accepts JSON object keys allowed by the schema", () => {
  const fixture = createFixture();
  const evidence = createCanonicalEvidence({
    ...fixture,
    metadata: {
      ...fixture.metadata,
      properties: {
        "!bang": true,
        "10": 10,
        "2": 2,
        "@context": "schema",
        A: "upper",
        a: "lower",
        "a-1": "punctuation",
        "key with spaces": "space",
        "é": "accent",
        "Ω": "omega",
        "ключ": "unicode",
      },
    },
    structure: {
      ...fixture.structure,
      nodes: [
        fixture.structure.nodes[0]!,
        {
          ...fixture.structure.nodes[1]!,
          attributes: {
            "!bang": true,
            "10": 10,
            "2": 2,
            "@context": "schema",
            A: "upper",
            a: "lower",
            "a-1": "punctuation",
            "key with spaces": "space",
            "é": "accent",
            "Ω": "omega",
            "ключ": "unicode",
          },
        },
      ],
    },
    relationships: [
      {
        ...fixture.relationships[0]!,
        metadata: {
          "!bang": true,
          "10": 10,
          "2": 2,
          "@context": "schema",
          A: "upper",
          a: "lower",
          "a-1": "punctuation",
          "key with spaces": "space",
          "é": "accent",
          "Ω": "omega",
          "ключ": "unicode",
        },
      },
    ],
  });

  assert.equal(evidence.metadata.properties["!bang"], true);
  assert.equal(evidence.metadata.properties["10"], 10);
  assert.equal(evidence.metadata.properties["2"], 2);
  assert.equal(evidence.metadata.properties["@context"], "schema");
  assert.equal(evidence.metadata.properties.A, "upper");
  assert.equal(evidence.metadata.properties.a, "lower");
  assert.equal(evidence.metadata.properties["a-1"], "punctuation");
  assert.equal(evidence.metadata.properties["key with spaces"], "space");
  assert.equal(evidence.metadata.properties["é"], "accent");
  assert.equal(evidence.metadata.properties["Ω"], "omega");
  assert.equal(evidence.metadata.properties["ключ"], "unicode");
  assert.equal(evidence.relationships[0]?.metadata["@context"], "schema");

  const serialized = evidence.toString();
  assert.equal(serialized, createCanonicalEvidence({
    ...fixture,
    metadata: evidence.metadata,
    structure: evidence.structure,
    relationships: evidence.relationships,
  }).toString());

  const repeated = evidence.toString();
  assert.equal(repeated, serialized);
  assert.equal(computeCanonicalEvidenceChecksum(canonicalEvidencePayload(evidence.toJSON())), evidence.checksum);
  assert.equal(
    computeCanonicalEvidenceChecksum(canonicalEvidencePayload(parseCanonicalEvidence(evidence.toJSON()).toJSON())),
    evidence.checksum,
  );
  assert.ok(serialized.indexOf('"!bang"') < serialized.indexOf('"10"'));
  assert.ok(serialized.indexOf('"10"') < serialized.indexOf('"2"'));
  assert.ok(serialized.indexOf('"2"') < serialized.indexOf('"@context"'));
  assert.ok(serialized.indexOf('"@context"') < serialized.indexOf('"A"'));
  assert.ok(serialized.indexOf('"A"') < serialized.indexOf('"a"'));
  assert.ok(serialized.indexOf('"a"') < serialized.indexOf('"a-1"'));
});

test("rejects invalid structure roots and encoding values", () => {
  const invalidStructure = createFixture();
  invalidStructure.structure.rootId = "missing-root";
  assert.throws(() => createCanonicalEvidence(invalidStructure), EvidenceValidationError);

  type Fixture = ReturnType<typeof createFixture>;
  const invalidEncoding: Omit<Fixture, "content"> & {
    content: Omit<Fixture["content"], "encoding"> & { encoding: string };
  } = {
    ...createFixture(),
    content: {
      ...createFixture().content,
      encoding: "binary",
    },
  };

  assert.throws(() => createCanonicalEvidence(invalidEncoding as never), EvidenceValidationError);
});

test("generates a JSON schema that covers the canonical record", () => {
  const schema = generateCanonicalEvidenceSchema();
  const required = schema.required as readonly string[];
  const properties = schema.properties as Record<string, unknown>;

  assert.equal(schema.type, "object");
  assert.ok(Array.isArray(required));
  assert.ok(required.includes("identity"));
  assert.ok(required.includes("integrity"));
  assert.equal(typeof properties.schemaVersion, "object");
});

test("supports explicit validation of canonical records", () => {
  const evidence = CanonicalEvidence.create(createFixture());

  assert.doesNotThrow(() => {
    const parsed = CanonicalEvidence.fromJSON(evidence.toJSON());
    assert.equal(parsed.checksum, evidence.checksum);
  });
});