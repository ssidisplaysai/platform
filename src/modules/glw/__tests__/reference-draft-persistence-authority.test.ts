jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  consumeGlwReferenceDraftPersistenceGrant,
  issueGlwReferenceDraftPersistenceGrant,
  issueGlwReferenceDraftPersistencePreflight,
  projectGlwReferenceDraftPersistenceGrant,
} from "../reference-draft-persistence-authority";

const principal = { principalId: "owner", sessionId: "session", authority: "GENESIS_SERVER_SESSION_V1" };
const now = new Date("2030-01-01T00:00:00.000Z");
const context = {
  operationType: "REFERENCE_DRAFT_PERSISTENCE" as const,
  organizationId: "org",
  siteId: "site",
  campaignId: "campaign",
  referenceState: "IN",
  generationJobId: "job",
  n8nExecutionId: "644114",
  rawArtifactSha256: "a".repeat(64),
  canonicalizedArtifactSha256: "b".repeat(64),
  canonicalizationReceiptId: "receipt",
  canonicalizationPolicyVersion: "GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_V1",
  canonicalizationPolicyFingerprint: "c".repeat(64),
  generatorContractFingerprint: "d".repeat(64),
  qaPolicyFingerprint: "4".repeat(64),
  qaFingerprint: "e".repeat(64),
  localizationPolicyFingerprint: "5".repeat(64),
  wordpressReadAuthorityFingerprint: "f".repeat(64),
  wordpressInventoryFingerprint: "6".repeat(64),
  canonicalPath: "outdoor-digital-sphere/indiana",
  parentId: "100",
  parentSlug: "outdoor-digital-sphere",
  parentStatus: "draft" as const,
  exactRuntime: "1".repeat(40),
};

describe("reference draft persistence authority", () => {
  let root: string;
  const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "glw-draft-authority-")); process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root; });
  afterEach(() => { if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR; else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original; rmSync(root, { recursive: true, force: true }); });

  test("issues one exact grant and atomically denies replay", () => {
    const preflight = issueGlwReferenceDraftPersistencePreflight({ principal, context, now });
    const grant = issueGlwReferenceDraftPersistenceGrant({ principal, preflightId: preflight.preflightId, liveContext: context, now });
    expect(projectGlwReferenceDraftPersistenceGrant({ principal, liveContext: context, now })).toMatchObject({ grantId: grant.grantId, valid: true });
    const claim = consumeGlwReferenceDraftPersistenceGrant({ principal, preflightId: preflight.preflightId, grantId: grant.grantId, liveContext: context, now });
    expect(claim).toMatchObject({ grantId: grant.grantId, canonicalizedArtifactSha256: "b".repeat(64) });
    expect(() => consumeGlwReferenceDraftPersistenceGrant({ principal, preflightId: preflight.preflightId, grantId: grant.grantId, liveContext: context, now })).toThrow("already consumed");
  });

  test("rejects stale or mismatched authority", () => {
    const preflight = issueGlwReferenceDraftPersistencePreflight({ principal, context, now });
    expect(() => issueGlwReferenceDraftPersistenceGrant({ principal, preflightId: preflight.preflightId, liveContext: context, now: new Date("2030-01-01T00:02:01.000Z") })).toThrow("expired");
    expect(() => issueGlwReferenceDraftPersistenceGrant({ principal, preflightId: preflight.preflightId, liveContext: { ...context, canonicalizedArtifactSha256: "9".repeat(64) }, now })).toThrow("canonicalizedArtifactSha256");
  });

  test("binds principal, session, runtime, policy, QA, WordPress, path, and parent", () => {
    const preflight = issueGlwReferenceDraftPersistencePreflight({ principal, context, now });
    const grant = issueGlwReferenceDraftPersistenceGrant({ principal, preflightId: preflight.preflightId, liveContext: context, now });
    const mismatches = [
      { principal: { ...principal, sessionId: "other" }, context },
      { principal, context: { ...context, exactRuntime: "2".repeat(40) } },
      { principal, context: { ...context, canonicalizationPolicyFingerprint: "9".repeat(64) } },
      { principal, context: { ...context, qaFingerprint: "9".repeat(64) } },
      { principal, context: { ...context, wordpressReadAuthorityFingerprint: "9".repeat(64) } },
      { principal, context: { ...context, wordpressInventoryFingerprint: "9".repeat(64) } },
      { principal, context: { ...context, canonicalPath: "other/path" } },
      { principal, context: { ...context, parentId: "101" } },
      { principal, context: { ...context, parentStatus: "publish" as never } },
    ];
    for (const mismatch of mismatches) {
      expect(() => consumeGlwReferenceDraftPersistenceGrant({ principal: mismatch.principal, preflightId: preflight.preflightId, grantId: grant.grantId, liveContext: mismatch.context, now })).toThrow();
    }
  });
});
