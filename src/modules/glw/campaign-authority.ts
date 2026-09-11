import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GlwCampaignOwnershipAssessment } from "./launchpad-planning-authority";
import type { GlwCampaignPublicationPolicy } from "./campaign-types";

const CAMPAIGN_FILE = "glw-campaign-repository.json";
const TARGET_FILE = "glw-campaign-target-repository.json";

export type GlwPersistedCampaignStatus = "draft" | "active" | "paused" | "complete";
export type GlwPersistedCampaignTargetStatus =
  | "prepared"
  | "reference_complete"
  | "queued"
  | "running"
  | "draft_ready"
  | "published"
  | "failed"
  | "skipped";

export type GlwPersistedCampaign = {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  pageType: "state_service" | "city_service";
  publicationPolicy?: GlwCampaignPublicationPolicy;
  imageRequired?: boolean;
  status: GlwPersistedCampaignStatus;
};

export type GlwPersistedCampaignTarget = {
  targetId: string;
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  stateCode: string;
  citySlug?: string | null;
  cityName?: string | null;
  status: GlwPersistedCampaignTargetStatus;
  jobId: string | null;
  wordpressObjectId: string | null;
  lastError: string | null;
};

export type GlwCampaignAuthoritySnapshot = {
  checked: true;
  source: "GLW_CAMPAIGN_PERSISTENCE";
  persistenceIdentity: string;
  campaignRevision: number;
  targetRevision: number;
  campaigns: readonly GlwPersistedCampaign[];
  targets: readonly GlwPersistedCampaignTarget[];
};

type PersistenceEnvelope<T> = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  data: T;
};

function parseEnvelope<T>(raw: string, identity: string): PersistenceEnvelope<T> {
  const parsed = JSON.parse(raw) as Partial<PersistenceEnvelope<T>>;
  if (parsed.schemaVersion !== 1 || typeof parsed.revision !== "number" || !parsed.data) {
    throw new Error(`Campaign authority envelope ${identity} is malformed or unsupported.`);
  }
  return parsed as PersistenceEnvelope<T>;
}

export function readGlwCampaignAuthoritySnapshot(input: {
  persistenceDirectory?: string | null;
  readFile?: (path: string) => string;
} = {}): GlwCampaignAuthoritySnapshot | null {
  const persistenceDirectory = input.persistenceDirectory?.trim()
    || process.env.GLW_CAMPAIGN_AUTHORITY_PERSISTENCE_DIR?.trim()
    || process.env.GCP_FOUNDATION_PERSISTENCE_DIR?.trim();

  if (!persistenceDirectory) return null;
  const readFile = input.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  try {
    const campaignEnvelope = parseEnvelope<{ campaigns: GlwPersistedCampaign[] }>(
      readFile(join(persistenceDirectory, CAMPAIGN_FILE)),
      CAMPAIGN_FILE,
    );
    const targetEnvelope = parseEnvelope<{ targets: GlwPersistedCampaignTarget[] }>(
      readFile(join(persistenceDirectory, TARGET_FILE)),
      TARGET_FILE,
    );
    if (!Array.isArray(campaignEnvelope.data.campaigns) || !Array.isArray(targetEnvelope.data.targets)) {
      return null;
    }
    return {
      checked: true,
      source: "GLW_CAMPAIGN_PERSISTENCE",
      persistenceIdentity: persistenceDirectory,
      campaignRevision: campaignEnvelope.revision,
      targetRevision: targetEnvelope.revision,
      campaigns: structuredClone(campaignEnvelope.data.campaigns),
      targets: structuredClone(targetEnvelope.data.targets),
    };
  } catch {
    return null;
  }
}

function normalizeCitySlug(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ?? "";
  return normalized || null;
}

function retainsOwnership(target: GlwPersistedCampaignTarget): boolean {
  // Runtime recovery keeps failed/skipped targets durable; no existing transition releases ownership.
  return ["prepared", "reference_complete", "queued", "running", "draft_ready", "published", "failed", "skipped"].includes(target.status);
}

export function getGlwCampaignOwnershipForTarget(input: {
  snapshot: GlwCampaignAuthoritySnapshot;
  organizationId: string;
  siteId: string;
  productId: string;
  pageType: "state_service" | "city_service";
  stateCode: string;
  citySlug?: string | null;
}): GlwCampaignOwnershipAssessment {
  const persistenceIdentity = `GLW_CAMPAIGN_PERSISTENCE:${input.snapshot.campaignRevision}:${input.snapshot.targetRevision}`;
  const stateCode = input.stateCode.trim().toUpperCase();
  const citySlug = normalizeCitySlug(input.citySlug);
  const matches = input.snapshot.targets.filter((target) =>
    target.organizationId === input.organizationId
    && target.siteId === input.siteId
    && target.productId === input.productId
    && target.stateCode.trim().toUpperCase() === stateCode
    && (input.pageType === "city_service"
      ? normalizeCitySlug(target.citySlug) === citySlug
      : normalizeCitySlug(target.citySlug) === null)
    && retainsOwnership(target),
  );
  if (matches.length === 0) {
    return {
      checked: true,
      classification: "AVAILABLE",
      campaignId: null,
      campaignState: null,
      targetState: null,
      reconciled: true,
      persistenceIdentity,
      reason: `Checked campaign persistence has no owner for this exact ${input.pageType === "city_service" ? "city" : "state"} intent.`,
      authoritySource: "CAMPAIGN_PERSISTENCE",
    };
  }
  if (matches.length > 1) {
    return {
      checked: true,
      classification: "UNRECONCILED",
      campaignId: null,
      campaignState: null,
      targetState: null,
      reconciled: false,
      persistenceIdentity,
      reason: "Multiple persisted campaign targets claim this exact city intent.",
      authoritySource: "CAMPAIGN_PERSISTENCE",
    };
  }
  const target = matches[0];
  const campaign = input.snapshot.campaigns.find((candidate) => candidate.campaignId === target.campaignId);
  if (!campaign || campaign.organizationId !== target.organizationId || campaign.siteId !== target.siteId || campaign.productId !== target.productId || campaign.pageType !== input.pageType) {
    return {
      checked: true,
      classification: "UNRECONCILED",
      campaignId: target.campaignId,
      campaignState: campaign?.status ?? null,
      targetState: target.status,
      reconciled: false,
      persistenceIdentity,
      reason: "Campaign target ownership does not reconcile to its persisted campaign identity.",
      authoritySource: "CAMPAIGN_PERSISTENCE",
    };
  }
  if (target.status === "failed") {
    return {
      checked: true,
      classification: "UNRECONCILED",
      campaignId: campaign.campaignId,
      campaignState: campaign.status,
      targetState: target.status,
      reconciled: false,
      persistenceIdentity,
      reason: "Failed campaign target remains reserved pending explicit recovery or reconciliation.",
      authoritySource: "CAMPAIGN_PERSISTENCE",
    };
  }
  return {
    checked: true,
    classification: campaign.status === "complete" ? "OWNED_BY_COMPLETED_CAMPAIGN" : "OWNED_BY_ACTIVE_CAMPAIGN",
    campaignId: campaign.campaignId,
    campaignState: campaign.status,
    targetState: target.status,
    reconciled: true,
    persistenceIdentity,
    reason: `Persisted campaign target retains ownership in ${target.status} state.`,
    authoritySource: "CAMPAIGN_PERSISTENCE",
  };
}