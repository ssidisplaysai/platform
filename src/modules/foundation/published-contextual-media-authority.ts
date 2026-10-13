import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { deepClone, FoundationPersistenceConflictError, loadPersistedState, savePersistedState } from "./foundation-persistence";

export const PUBLISHED_CONTEXTUAL_MEDIA_UPDATE = "PUBLISHED_CONTEXTUAL_MEDIA_UPDATE" as const;
export const CONTEXTUAL_MEDIA_URL_TOKEN = "{{CONTEXTUAL_MEDIA_URL}}";

export type PublishedContextualPage = {
  id: number;
  slug: string;
  status: string;
  parent: number;
  featuredMediaId: number;
  content: string;
  canonicalUrl: string;
  robots: Readonly<Record<string, string>>;
  title: string;
};

export type ContextualMediaRecord = {
  id: number;
  url: string;
  altText: string;
  mediaType: string;
};

export type GeneratedContextualMediaProvenance = {
  provider: string;
  generationJobId: string;
  prompt: string;
  createdAt: string;
  targetSiteId: string;
  targetPageId: number;
  role: "contextual_application_media";
  altText: string;
  contentSha256: string;
};

export type PublishedContextualMediaInput = {
  operation: typeof PUBLISHED_CONTEXTUAL_MEDIA_UPDATE;
  transactionId?: string;
  siteId: string;
  pageId: number;
  expectedContentSha256: string;
  expectedSlug: string;
  expectedCanonicalUrl: string;
  expectedFeaturedMediaId: number;
  featuredMediaPolicy: "PRESERVE";
  replacements: readonly {
    name: string;
    exactAnchor: string;
    replacementHtml: string;
  }[];
  media:
    | {
        type: "EXISTING_CONTEXTUAL";
        mediaId: number;
        expectedUrl: string;
        provenance: "PRODUCT_INTELLIGENCE" | "OWNER_APPROVED_EXISTING_MEDIA";
        altText: string;
      }
    | {
        type: "GENERATED_CONTEXTUAL";
        bytes: Buffer;
        mimeType: "image/jpeg" | "image/png" | "image/webp";
        fileExtension: "jpg" | "png" | "webp";
        provenance: GeneratedContextualMediaProvenance;
      };
  acceptance: {
    requiredHtml: readonly string[];
    prohibitedHtml: readonly string[];
  };
};

export type PublishedContextualMediaEvidence = {
  transactionId: string;
  siteId: string;
  pageId: number;
  state: "ACTIVE" | "COMMITTED" | "ROLLED_BACK" | "ORPHAN_CLEANUP_REQUIRED" | "FAILED_PRECONDITION";
  mediaOperation: PublishedContextualMediaInput["media"]["type"];
  originalContentSha256: string | null;
  intendedContentSha256: string | null;
  finalContentSha256: string | null;
  originalFeaturedMediaId: number | null;
  finalFeaturedMediaId: number | null;
  contextualMediaId: number | null;
  contextualMediaUrl: string | null;
  generatedMediaProvenance: GeneratedContextualMediaProvenance | null;
  changedRegions: readonly string[];
  rollbackPageVerified: boolean;
  generatedMediaDeleted: boolean;
  orphanCleanupRequired: boolean;
  failureCode: string | null;
  createdAt: string;
  completedAt: string | null;
};

type EvidenceState = { records: PublishedContextualMediaEvidence[] };
const NAMESPACE = "published-contextual-media-evidence";
const ACTIVE_TRANSACTION_TTL_MS = 15 * 60 * 1000;
let evidenceRevision = 0;
let evidenceRecords: PublishedContextualMediaEvidence[] = [];
const pageQueues = new Map<string, Promise<void>>();

function loadEvidence(): void {
  const loaded = loadPersistedState<EvidenceState>({ namespace: NAMESPACE, seedFactory: () => ({ records: [] }) });
  evidenceRevision = loaded.revision;
  evidenceRecords = loaded.state.records;
}
function persistEvidence(): void {
  const saved = savePersistedState({ namespace: NAMESPACE, state: { records: evidenceRecords }, expectedRevision: evidenceRevision });
  evidenceRevision = saved.revision;
}
function saveEvidence(record: PublishedContextualMediaEvidence): void {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    loadEvidence();
    const index = evidenceRecords.findIndex((candidate) => candidate.transactionId === record.transactionId);
    if (index >= 0) evidenceRecords[index] = deepClone(record); else evidenceRecords.push(deepClone(record));
    try { persistEvidence(); return; } catch (error) {
      if (!(error instanceof FoundationPersistenceConflictError) || attempt === 2) throw error;
    }
  }
}

function acquireDurablePageMutation(record: PublishedContextualMediaEvidence): boolean {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    loadEvidence();
    const now = Date.now();
    evidenceRecords = evidenceRecords.map((candidate) => {
      if (candidate.state !== "ACTIVE" || now - Date.parse(candidate.createdAt) <= ACTIVE_TRANSACTION_TTL_MS) return candidate;
      return { ...candidate, state: "ORPHAN_CLEANUP_REQUIRED" as const, orphanCleanupRequired: true, failureCode: "STALE_ACTIVE_TRANSACTION", completedAt: new Date().toISOString() };
    });
    if (evidenceRecords.some((candidate) => candidate.siteId === record.siteId && candidate.pageId === record.pageId && candidate.state === "ACTIVE")) return false;
    if (evidenceRecords.some((candidate) => candidate.transactionId === record.transactionId)) return false;
    evidenceRecords.push(deepClone(record));
    try { persistEvidence(); return true; } catch (error) {
      if (!(error instanceof FoundationPersistenceConflictError) || attempt === 2) throw error;
    }
  }
  return false;
}
export function listPublishedContextualMediaEvidence(): PublishedContextualMediaEvidence[] {
  loadEvidence();
  return deepClone(evidenceRecords);
}
export function resetPublishedContextualMediaEvidenceForTests(): void {
  const reset = loadPersistedState<EvidenceState>({ namespace: NAMESPACE, seedFactory: () => ({ records: [] }) });
  evidenceRecords = [];
  evidenceRevision = reset.revision;
  try { persistEvidence(); } catch { loadEvidence(); }
}

export type PublishedContextualMediaTransport = {
  readPage(pageId: number): Promise<PublishedContextualPage | null>;
  verifyTargetAuthority(page: PublishedContextualPage): Promise<boolean>;
  readMedia(mediaId: number): Promise<ContextualMediaRecord | null>;
  uploadGeneratedMedia(input: { bytes: Buffer; mimeType: string; fileExtension: string; title: string }): Promise<ContextualMediaRecord>;
  updateMediaMetadata(mediaId: number, input: { altText: string; description: string }): Promise<boolean>;
  writePublishedPageContent(pageId: number, input: { content: string; featuredMediaId: number }): Promise<boolean>;
  fetchPublicHtml(canonicalUrl: string): Promise<{ status: number; html: string }>;
  findMediaReferences(mediaId: number): Promise<readonly number[]>;
  deleteGeneratedMedia(mediaId: number): Promise<boolean>;
};

export type PublishedContextualMediaResult =
  | { ok: true; evidence: PublishedContextualMediaEvidence }
  | { ok: false; code: string; message: string; evidence: PublishedContextualMediaEvidence };

function sha256(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
function occurrences(value: string, search: string): number { return value.split(search).length - 1; }
function validHash(value: string): boolean { return /^[a-f0-9]{64}$/.test(value); }

async function withPageLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = pageQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  pageQueues.set(key, queued);
  await previous;
  try { return await operation(); } finally { release(); if (pageQueues.get(key) === queued) pageQueues.delete(key); }
}

export async function executePublishedContextualMediaUpdate(input: PublishedContextualMediaInput, transport: PublishedContextualMediaTransport): Promise<PublishedContextualMediaResult> {
  const transactionId = input.transactionId?.trim() || randomUUID();
  const now = new Date().toISOString();
  const evidence: PublishedContextualMediaEvidence = {
    transactionId, siteId: input.siteId, pageId: input.pageId, state: "ACTIVE", mediaOperation: input.media.type,
    originalContentSha256: null, intendedContentSha256: null, finalContentSha256: null,
    originalFeaturedMediaId: null, finalFeaturedMediaId: null, contextualMediaId: null, contextualMediaUrl: null,
    generatedMediaProvenance: input.media.type === "GENERATED_CONTEXTUAL" ? deepClone(input.media.provenance) : null,
    changedRegions: input.replacements.map((replacement) => replacement.name), rollbackPageVerified: false,
    generatedMediaDeleted: false, orphanCleanupRequired: false, failureCode: null, createdAt: now, completedAt: null,
  };

  return withPageLock(`${input.siteId}:${input.pageId}`, async () => {
    if (!acquireDurablePageMutation(evidence)) {
      evidence.state = "FAILED_PRECONDITION"; evidence.failureCode = "PAGE_MUTATION_ACTIVE"; evidence.completedAt = new Date().toISOString();
      return { ok: false, code: "PAGE_MUTATION_ACTIVE", message: "Another published contextual-media transaction is active for this page.", evidence };
    }

    let original: PublishedContextualPage | null = null;
    let generatedMedia = false;
    let pageMutated = false;
    try {
      const replacementNames = input.replacements.map((replacement) => replacement.name.trim());
      if (input.operation !== PUBLISHED_CONTEXTUAL_MEDIA_UPDATE || input.featuredMediaPolicy !== "PRESERVE" || input.siteId !== "site-ssi-projectorenclosure" || !Number.isSafeInteger(input.pageId) || input.pageId <= 0 || !validHash(input.expectedContentSha256) || input.replacements.length === 0 || input.replacements.length > 8 || replacementNames.some((name) => !name) || new Set(replacementNames).size !== replacementNames.length || input.replacements.some((replacement) => replacement.exactAnchor.length > 100_000 || replacement.replacementHtml.length > 100_000)) throw new Error("INVALID_AUTHORITY_INPUT");
      original = await transport.readPage(input.pageId);
      if (!original || original.id !== input.pageId || original.status !== "publish" || original.slug !== input.expectedSlug || original.canonicalUrl !== input.expectedCanonicalUrl || original.featuredMediaId !== input.expectedFeaturedMediaId || sha256(original.content) !== input.expectedContentSha256) throw new Error("PAGE_PRECONDITION_MISMATCH");
      if (!await transport.verifyTargetAuthority(original)) throw new Error("TARGET_AUTHORITY_COLLISION");
      evidence.originalContentSha256 = sha256(original.content); evidence.originalFeaturedMediaId = original.featuredMediaId;

      let media: ContextualMediaRecord;
      if (input.media.type === "EXISTING_CONTEXTUAL") {
        const existing = await transport.readMedia(input.media.mediaId);
        if (!existing || existing.id !== input.media.mediaId || existing.url !== input.media.expectedUrl || existing.mediaType !== "image") throw new Error("EXISTING_MEDIA_PRECONDITION_MISMATCH");
        media = existing;
      } else {
        const provenance = input.media.provenance;
        if (provenance.targetSiteId !== input.siteId || provenance.targetPageId !== input.pageId || provenance.role !== "contextual_application_media" || provenance.altText.trim() === "" || provenance.contentSha256 !== sha256(input.media.bytes)) throw new Error("GENERATED_MEDIA_PROVENANCE_INVALID");
        media = await transport.uploadGeneratedMedia({ bytes: input.media.bytes, mimeType: input.media.mimeType, fileExtension: input.media.fileExtension, title: provenance.altText });
        generatedMedia = true;
        const metadataOk = await transport.updateMediaMetadata(media.id, { altText: provenance.altText, description: `Generated contextual application media for page ${input.pageId}; not an actual customer installation.` });
        if (!metadataOk) throw new Error("GENERATED_MEDIA_METADATA_FAILED");
      }
      evidence.contextualMediaId = media.id; evidence.contextualMediaUrl = media.url; saveEvidence(evidence);

      let intended = original.content;
      for (const replacement of input.replacements) {
        if (!replacement.name.trim() || !replacement.exactAnchor || occurrences(intended, replacement.exactAnchor) !== 1) throw new Error("ANCHOR_PRECONDITION_MISMATCH");
        const replacementHtml = replacement.replacementHtml.replaceAll(CONTEXTUAL_MEDIA_URL_TOKEN, media.url);
        if (replacementHtml.includes(CONTEXTUAL_MEDIA_URL_TOKEN)) throw new Error("MEDIA_URL_TOKEN_UNRESOLVED");
        intended = intended.replace(replacement.exactAnchor, replacementHtml);
      }
      if (intended === original.content) throw new Error("EMPTY_CONTENT_DIFF");
      evidence.intendedContentSha256 = sha256(intended); saveEvidence(evidence);

      const writeOk = await transport.writePublishedPageContent(input.pageId, { content: intended, featuredMediaId: original.featuredMediaId });
      if (!writeOk) throw new Error("PAGE_WRITE_FAILED");
      pageMutated = true;
      const readback = await transport.readPage(input.pageId);
      if (!readback || readback.content !== intended || readback.featuredMediaId !== original.featuredMediaId || readback.title !== original.title || readback.slug !== original.slug || readback.status !== "publish" || readback.parent !== original.parent || readback.canonicalUrl !== original.canonicalUrl || JSON.stringify(readback.robots) !== JSON.stringify(original.robots)) throw new Error("PAGE_READBACK_MISMATCH");
      const publicResult = await transport.fetchPublicHtml(original.canonicalUrl);
      const expectedAlt = input.media.type === "GENERATED_CONTEXTUAL" ? input.media.provenance.altText : input.media.altText;
      const imageTags = [...publicResult.html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
      const contextualImageRendered = imageTags.some((tag) => tag.includes(`src="${media.url}"`) && tag.includes(`alt="${expectedAlt}"`));
      if (publicResult.status !== 200 || !contextualImageRendered || input.acceptance.requiredHtml.some((value) => !publicResult.html.includes(value)) || input.acceptance.prohibitedHtml.some((value) => publicResult.html.includes(value))) throw new Error("PUBLIC_ACCEPTANCE_FAILED");

      evidence.state = "COMMITTED"; evidence.finalContentSha256 = sha256(readback.content); evidence.finalFeaturedMediaId = readback.featuredMediaId; evidence.completedAt = new Date().toISOString(); saveEvidence(evidence);
      return { ok: true, evidence };
    } catch (error) {
      const code = error instanceof Error ? error.message : "CONTEXTUAL_MEDIA_UPDATE_FAILED";
      let pageRestored = !pageMutated;
      if (pageMutated && original) {
        const restored = await transport.writePublishedPageContent(input.pageId, { content: original.content, featuredMediaId: original.featuredMediaId });
        const verify = restored ? await transport.readPage(input.pageId) : null;
        pageRestored = Boolean(verify && verify.content === original.content && verify.featuredMediaId === original.featuredMediaId && verify.status === "publish");
      }
      evidence.rollbackPageVerified = pageRestored;
      if (generatedMedia && evidence.contextualMediaId) {
        const references = await transport.findMediaReferences(evidence.contextualMediaId);
        if (pageRestored && references.length === 0 && evidence.contextualMediaId !== evidence.originalFeaturedMediaId) {
          evidence.generatedMediaDeleted = await transport.deleteGeneratedMedia(evidence.contextualMediaId);
        }
        evidence.orphanCleanupRequired = !evidence.generatedMediaDeleted;
      }
      evidence.state = evidence.orphanCleanupRequired ? "ORPHAN_CLEANUP_REQUIRED" : "ROLLED_BACK";
      if (!original || !evidence.originalContentSha256) evidence.state = "FAILED_PRECONDITION";
      evidence.failureCode = code; evidence.completedAt = new Date().toISOString(); saveEvidence(evidence);
      return { ok: false, code, message: "Published contextual-media update failed closed.", evidence };
    }
  });
}
