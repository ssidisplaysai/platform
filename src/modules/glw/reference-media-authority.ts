import "server-only";

import { createHash } from "node:crypto";
import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

const NAMESPACE = "glw-reference-media-authority-v1";
const CA_CAMPAIGN_ID = "campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-multi-state-benchmark";

export type GlwReferenceMediaAuthority = {
  authorityId: string;
  organizationId: string;
  siteId: string;
  campaignId: string;
  stateCode: string;
  jobId: string;
  externalExecutionId: string;
  wordpressObjectId: string;
  wordpressMediaId: string;
  mediaUrl: string;
  sourceType: "GENESIS_GENERATED_MEDIA";
  semanticRole: "LOCAL_CONTEXTUAL_ATMOSPHERE";
  provenanceStatus: "PROVEN_BOUNDED";
  provenanceEvidence: readonly string[];
  lineageLimitations: readonly string[];
  ownerApprovalStatus: "REQUIRED" | "APPROVED";
  approvedBy: string | null;
  approvedSessionId: string | null;
  approvedAt: string | null;
  lineageFingerprint: string;
};

type State = { records: GlwReferenceMediaAuthority[] };

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function californiaAuthority(): GlwReferenceMediaAuthority {
  const semantic = {
    authorityId: "glw-reference-media-ssi-accent-ca-15338-v1",
    organizationId: "ssi",
    siteId: "site-ssi-screen-solutions-international",
    campaignId: CA_CAMPAIGN_ID,
    stateCode: "CA",
    jobId: "e2f30c1d-8511-4435-a15b-f0110c66eb63",
    externalExecutionId: "478029",
    wordpressObjectId: "15336",
    wordpressMediaId: "15338",
    mediaUrl: "https://ssidisplays.com/wp-content/uploads/2026/09/california.jpg",
    sourceType: "GENESIS_GENERATED_MEDIA" as const,
    semanticRole: "LOCAL_CONTEXTUAL_ATMOSPHERE" as const,
    provenanceStatus: "PROVEN_BOUNDED" as const,
    provenanceEvidence: [
      "job:e2f30c1d-8511-4435-a15b-f0110c66eb63:qaChecks.mediaAuthority.selectedProvenance=GENERATED_MEDIA",
      "job:e2f30c1d-8511-4435-a15b-f0110c66eb63:featuredImagePresent=true",
      "wordpress-page:15336:featured_media=15338",
      "wordpress-media:15338:title=Accent Rear Projection Film in California",
      "wordpress-media:15338:file=2026/09/california.jpg",
      "wordpress-media:15338:created=2026-09-07T16:13:34Z",
    ],
    lineageLimitations: [
      "Provider generation identifier and source-byte hash were not persisted.",
      "Historical owner approval was not persisted and is not inferred.",
      "The media does not establish product geometry or product specifications.",
    ],
  };
  return {
    ...semantic,
    ownerApprovalStatus: "REQUIRED",
    approvedBy: null,
    approvedSessionId: null,
    approvedAt: null,
    lineageFingerprint: fingerprint(semantic),
  };
}

function seed(): State {
  return { records: [californiaAuthority()] };
}

export function getGlwReferenceMediaAuthority(campaignId: string, stateCode: string): GlwReferenceMediaAuthority | null {
  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  const record = loaded.state.records.find((candidate) => candidate.campaignId === campaignId && candidate.stateCode === stateCode);
  return record ? deepClone(record) : null;
}

export function approveGlwReferenceMediaAuthority(input: {
  campaignId: string;
  stateCode: string;
  wordpressMediaId: string;
  expectedLineageFingerprint: string;
  principalId: string;
  sessionId: string;
  now?: Date;
}): GlwReferenceMediaAuthority {
  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  const record = loaded.state.records.find((candidate) => candidate.campaignId === input.campaignId && candidate.stateCode === input.stateCode);
  if (!record || record.wordpressMediaId !== input.wordpressMediaId) throw new Error("REFERENCE_MEDIA_NOT_FOUND");
  if (record.lineageFingerprint !== input.expectedLineageFingerprint) throw new Error("REFERENCE_MEDIA_LINEAGE_CHANGED");
  if (record.ownerApprovalStatus === "APPROVED") return deepClone(record);
  record.ownerApprovalStatus = "APPROVED";
  record.approvedBy = input.principalId;
  record.approvedSessionId = input.sessionId;
  record.approvedAt = (input.now ?? new Date()).toISOString();
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(record);
}