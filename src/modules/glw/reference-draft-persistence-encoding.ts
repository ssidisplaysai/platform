import { createHash } from "node:crypto";

import type { GlwGeneratedDraftArtifact } from "./page-execution";
import { normalizeGlwGeneratedText } from "./page-execution";
import type { GlwZeroAuthorityCanonicalizationReceipt } from "./zero-authority-claim-canonicalization";

const MOJIBAKE_PATTERN = /\uFFFD|â€™|â€˜|â€œ|â€�|â€“|â€”|â€¦|Â©|Â®|Â°|Â·|Â |[âÃÂ]/g;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function collectGlwMojibakeMarkers(value: string): string[] {
  return [...new Set(value.match(MOJIBAKE_PATTERN) ?? [])];
}

export function normalizeGlwDraftArtifactEncoding(artifact: GlwGeneratedDraftArtifact): {
  artifact: GlwGeneratedDraftArtifact;
  changed: boolean;
  markersBefore: string[];
  markersAfter: string[];
} {
  const normalized: GlwGeneratedDraftArtifact = {
    ...artifact,
    title: normalizeGlwGeneratedText(artifact.title),
    contentHtml: normalizeGlwGeneratedText(artifact.contentHtml),
    excerpt: artifact.excerpt ? normalizeGlwGeneratedText(artifact.excerpt) : null,
    seoTitle: artifact.seoTitle ? normalizeGlwGeneratedText(artifact.seoTitle) : null,
    metaDescription: artifact.metaDescription ? normalizeGlwGeneratedText(artifact.metaDescription) : null,
    focusKeyphrase: artifact.focusKeyphrase ? normalizeGlwGeneratedText(artifact.focusKeyphrase) : null,
  };

  const markersBefore = collectGlwMojibakeMarkers([
    artifact.title,
    artifact.contentHtml,
    artifact.excerpt ?? "",
    artifact.seoTitle ?? "",
    artifact.metaDescription ?? "",
    artifact.focusKeyphrase ?? "",
  ].join("\n"));

  const markersAfter = collectGlwMojibakeMarkers([
    normalized.title,
    normalized.contentHtml,
    normalized.excerpt ?? "",
    normalized.seoTitle ?? "",
    normalized.metaDescription ?? "",
    normalized.focusKeyphrase ?? "",
  ].join("\n"));

  return {
    artifact: normalized,
    changed: JSON.stringify(normalized) !== JSON.stringify(artifact),
    markersBefore,
    markersAfter,
  };
}

export function projectGlwLegacyEncodingNormalizedReceipt(input: {
  receipt: GlwZeroAuthorityCanonicalizationReceipt;
  rawArtifactHtml: string;
  canonicalizedArtifactHtml: string;
}): GlwZeroAuthorityCanonicalizationReceipt {
  const rawArtifactSha256 = sha256(input.rawArtifactHtml);
  const canonicalizedArtifactSha256 = sha256(input.canonicalizedArtifactHtml);

  return {
    ...input.receipt,
    receiptId: `glw-zero-authority-${rawArtifactSha256.slice(0, 12)}-${canonicalizedArtifactSha256.slice(0, 12)}`,
    rawArtifactSha256,
    canonicalizedArtifactSha256,
  };
}
