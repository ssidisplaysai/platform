import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import type {
  GlwCampaignKnowledgePack,
  GlwCampaignReference,
  GlwCampaignReferenceRole,
  GlwCampaignReferenceScope,
} from "./campaign-reference-types";

const PERSISTENCE_NAMESPACE = "glw-campaign-reference-repository";
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;

type State = { packs: GlwCampaignKnowledgePack[] };
const store = new Map<string, GlwCampaignKnowledgePack>();
let revision = 0;

function seed(): State { return { packs: [] }; }
function load(): void {
  const loaded = loadPersistedState<State>({ namespace: PERSISTENCE_NAMESPACE, seedFactory: seed });
  store.clear();
  loaded.state.packs.forEach((pack) => store.set(pack.campaignId, deepClone(pack)));
  revision = loaded.revision;
}
function persist(): void {
  const saved = savePersistedState<State>({
    namespace: PERSISTENCE_NAMESPACE,
    state: { packs: Array.from(store.values()).map((pack) => deepClone(pack)) },
    expectedRevision: revision,
  });
  revision = saved.revision;
}
function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "reference";
}
function rootDir(): string {
  return process.env.GCP_FOUNDATION_PERSISTENCE_DIR?.trim() || join(process.cwd(), ".gcp-foundation-data");
}

load();

export function getGlwCampaignKnowledgePack(campaignId: string): GlwCampaignKnowledgePack | null {
  load();
  const pack = store.get(campaignId);
  return pack ? deepClone(pack) : null;
}

export function updateGlwCampaignInstructions(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  instructions: string;
}): GlwCampaignKnowledgePack {
  load();
  const existing = store.get(input.campaignId);
  const pack: GlwCampaignKnowledgePack = {
    campaignId: input.campaignId,
    organizationId: input.organizationId,
    siteId: input.siteId,
    instructions: input.instructions.trim(),
    references: existing?.references ?? [],
    updatedAt: new Date().toISOString(),
  };
  store.set(input.campaignId, pack);
  persist();
  return deepClone(pack);
}

export function addGlwCampaignReference(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  scope: GlwCampaignReferenceScope;
  role: GlwCampaignReferenceRole;
}): { reference: GlwCampaignReference | null; error: string | null } {
  if (input.bytes.byteLength < 1) return { reference: null, error: "Reference file is empty." };
  if (input.bytes.byteLength > MAX_REFERENCE_BYTES) return { reference: null, error: "Reference file exceeds 20 MB." };

  load();
  const timestamp = new Date().toISOString();
  const referenceId = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const directory = join(rootDir(), "glw-campaign-references", safeSegment(input.campaignId));
  mkdirSync(directory, { recursive: true });
  const storedName = `${referenceId}-${safeSegment(input.fileName)}`;
  const storagePath = join(directory, storedName);
  writeFileSync(storagePath, input.bytes);

  const kind = input.mediaType.startsWith("image/") ? "image" : "document";
  const reference: GlwCampaignReference = {
    referenceId,
    campaignId: input.campaignId,
    organizationId: input.organizationId,
    siteId: input.siteId,
    kind,
    scope: input.scope,
    role: input.role,
    fileName: input.fileName,
    mediaType: input.mediaType || "application/octet-stream",
    sizeBytes: input.bytes.byteLength,
    storagePath,
    createdAt: timestamp,
  };
  const existing = store.get(input.campaignId);
  store.set(input.campaignId, {
    campaignId: input.campaignId,
    organizationId: input.organizationId,
    siteId: input.siteId,
    instructions: existing?.instructions ?? "",
    references: [...(existing?.references ?? []), reference],
    updatedAt: timestamp,
  });
  persist();
  return { reference: deepClone(reference), error: null };
}
