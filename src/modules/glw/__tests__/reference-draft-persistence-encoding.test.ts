import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  collectGlwMojibakeMarkers,
  normalizeGlwDraftArtifactEncoding,
  projectGlwLegacyEncodingNormalizedReceipt,
} from "../reference-draft-persistence-encoding";
import { isGlwExecutionQuarantined, type GlwGeneratedDraftArtifact, type GlwPageExecutionRecord } from "../page-execution";

function artifact(overrides: Partial<GlwGeneratedDraftArtifact> = {}): GlwGeneratedDraftArtifact {
  return {
    title: "Fan Cooled Projector Enclosures in Texas",
    contentHtml: "<p>Clean copy for Arlington projector enclosures.</p>",
    slug: "fan-cooled-projector-enclosures/texas/arlington",
    excerpt: "Clean excerpt",
    seoTitle: "Fan Cooled Projector Enclosures Texas",
    metaDescription: "Find fan cooled projector enclosures in Texas.",
    focusKeyphrase: "fan cooled projector enclosures texas",
    ...overrides,
  };
}

function executionRecord(overrides: Partial<GlwPageExecutionRecord> = {}): GlwPageExecutionRecord {
  return {
    jobId: "job-1",
    correlationId: "corr-1",
    executionTransport: "N8N_WEBHOOK",
    organizationId: "ssi",
    siteId: "site-ssi-projectorenclosure",
    productId: "prod-fan-cooled-projector-enclosures",
    productTopic: "Fan Cooled Projector Enclosures",
    state: "Texas",
    city: "Arlington",
    slug: "fan-cooled-projector-enclosures/texas/arlington",
    title: "Fan Cooled Projector Enclosures in Texas",
    seoTitle: "Fan Cooled Projector Enclosures in Texas",
    metaDescription: "Meta description",
    publicationIntent: "draft",
    status: "FAILED",
    externalExecutionId: "764948",
    wordpressObjectId: null,
    wordpressUrl: null,
    wordpressStatus: null,
    generatedDraft: artifact(),
    rawGeneratedDraft: artifact(),
    canonicalizedGeneratedDraft: artifact(),
    canonicalizationReceipt: null,
    errorCode: "GENERATED_CONTENT_QA_FAILED",
    errorMessage: "failed",
    requestedPublicationMode: "draft",
    disposition: null,
    qaStatus: "FAILED",
    qaChecks: null,
    qaFailureReasons: null,
    focusKeyphrase: "fan cooled projector enclosures texas",
    wordCount: 1600,
    featuredImagePresent: false,
    createdAt: "2026-09-22T00:00:00.000Z",
    dispatchedAt: "2026-09-22T00:00:10.000Z",
    updatedAt: "2026-09-22T00:00:20.000Z",
    completedAt: "2026-09-22T00:00:30.000Z",
    ...overrides,
  };
}

describe("reference draft persistence encoding", () => {
  test("detects the exact mojibake signatures that trigger FINAL_PRE_PERSISTENCE_QA_FAILED", () => {
    const sample = artifact({
      contentHtml: "<p>ArlingtonÃ¢â‚¬â„¢s stage projection plans â€™ must avoid drift.</p>",
    });

    const markers = collectGlwMojibakeMarkers(sample.contentHtml);

    expect(markers).toEqual(expect.arrayContaining(["Ã", "â", "â€™"]));
  });

  test("normalizes legacy mojibake into valid punctuation for the corrected candidate path", () => {
    const source = artifact({
      contentHtml: "<p>ArlingtonÃ¢â‚¬â„¢s guide uses fan-cooled housings â€” with stable airflow.</p>",
      title: "ArlingtonÃ¢â‚¬â„¢s projector enclosures",
    });

    const normalized = normalizeGlwDraftArtifactEncoding(source);

    expect(normalized.changed).toBe(true);
    expect(normalized.markersBefore.length).toBeGreaterThan(0);
    expect(normalized.markersAfter).toEqual([]);
    expect(normalized.artifact.contentHtml).toContain("Arlington’s guide");
    expect(normalized.artifact.title).toContain("Arlington’s");
  });

  test("keeps invalid replacement-character corruption failing after normalization", () => {
    const source = artifact({
      contentHtml: "<p>Arlington replacement char stays invalid: �.</p>",
    });

    const normalized = normalizeGlwDraftArtifactEncoding(source);

    expect(normalized.markersAfter).toContain("�");
  });

  test("keeps original happy-path artifacts unchanged", () => {
    const source = artifact();

    const normalized = normalizeGlwDraftArtifactEncoding(source);

    expect(normalized.changed).toBe(false);
    expect(normalized.markersBefore).toEqual([]);
    expect(normalized.markersAfter).toEqual([]);
    expect(normalized.artifact).toEqual(source);
  });

  test("quarantined duplicate executions remain non-finalizable", () => {
    const duplicate = executionRecord({
      disposition: "QUARANTINED_SUPERSEDED_DUPLICATE",
      errorCode: "DUPLICATE_JOB_QUARANTINED",
    });

    expect(isGlwExecutionQuarantined(duplicate)).toBe(true);
  });

  test("draft-only publication policy remains preserved in persistence route contract", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-draft-persistence/route.ts"),
      "utf8",
    );

    expect(route).toContain('operation: "CREATE"');
    expect(route).toContain('wordpressStatus: "draft"');
    expect(route).toContain("publicationMutation: false");
  });

  test("projects a refreshed canonicalization receipt when encoding normalization changes hash", () => {
    const receipt = {
      receiptId: "glw-zero-authority-old-old",
      policyVersion: "GLW_ZERO_AUTHORITY_CLAIM_CANONICALIZATION_V1",
      policyFingerprint: "f".repeat(64),
      rawArtifactSha256: "a".repeat(64),
      canonicalizedArtifactSha256: "b".repeat(64),
      authoritativeFactReferenceCount: 0,
      fallbackPolicy: "STRICT" as const,
      transformations: [],
      blockedClaims: [],
      consumesN8nExecution: false,
      modelInvoked: false,
    };

    const projected = projectGlwLegacyEncodingNormalizedReceipt({
      receipt,
      rawArtifactHtml: "raw source",
      canonicalizedArtifactHtml: "normalized source",
    });

    expect(projected.receiptId).toMatch(/^glw-zero-authority-[0-9a-f]{12}-[0-9a-f]{12}$/);
    expect(projected.rawArtifactSha256).not.toBe(receipt.rawArtifactSha256);
    expect(projected.canonicalizedArtifactSha256).not.toBe(receipt.canonicalizedArtifactSha256);
  });
});
