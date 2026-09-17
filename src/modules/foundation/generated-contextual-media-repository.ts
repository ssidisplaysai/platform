import "server-only";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deepClone, loadPersistedState, resolvePersistenceRoot, savePersistedState } from "./foundation-persistence";
import type { ContextualGenerationReceipt, ContextualMediaIdentity, GeneratedContextualAsset } from "@/modules/glw/contextual-media-production-adapter";

const NAMESPACE = "genesis-generated-contextual-media-v1";
const MEDIA_DIRECTORY = "generated-contextual-media";
type StoredRecord = ContextualGenerationReceipt & { storageKey: string; byteSize: number; wordpressMediaId: number | null; wordpressUrl: string | null };
type State = { schemaVersion: 1; records: StoredRecord[] };
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ schemaVersion: 1, records: [] }) });
const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-");
const extension = (mimeType: ContextualGenerationReceipt["mimeType"]) => mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";

function readBytes(record: StoredRecord): Buffer {
  const bytes = readFileSync(join(/* turbopackIgnore: true */ resolvePersistenceRoot(), MEDIA_DIRECTORY, record.storageKey));
  if (createHash("sha256").update(bytes).digest("hex") !== record.assetSha256) throw new Error("GENERATED_CONTEXTUAL_MEDIA_STORAGE_MISMATCH");
  return bytes;
}

function asset(record: StoredRecord): GeneratedContextualAsset {
  const { storageKey: _storageKey, byteSize: _byteSize, ...receipt } = record;
  void _storageKey; void _byteSize;
  return { receipt, bytes: readBytes(record), wordpressMediaId: record.wordpressMediaId, wordpressUrl: record.wordpressUrl };
}

export function findSuccessfulGeneratedContextualMedia(input: { identity: ContextualMediaIdentity; role: string; promptFingerprint: string }): GeneratedContextualAsset | null {
  const match = load().state.records.find((record) => record.status === "SUCCEEDED" && record.organizationId === input.identity.organizationId && record.siteId === input.identity.siteId && record.productId === input.identity.productId && record.targetId === input.identity.targetId && record.role === input.role && record.promptFingerprint === input.promptFingerprint);
  return match ? asset(match) : null;
}

export function saveSuccessfulGeneratedContextualMedia(input: { receipt: ContextualGenerationReceipt; bytes: Buffer }): GeneratedContextualAsset {
  if (!input.bytes.length || input.bytes.length > 20_000_000 || createHash("sha256").update(input.bytes).digest("hex") !== input.receipt.assetSha256) throw new Error("GENERATED_CONTEXTUAL_MEDIA_BINARY_INVALID");
  const loaded = load();
  const existing = loaded.state.records.find((record) => record.generationId === input.receipt.generationId);
  if (existing) {
    if (existing.assetSha256 !== input.receipt.assetSha256) throw new Error("GENERATED_CONTEXTUAL_MEDIA_IDENTITY_COLLISION");
    return asset(existing);
  }
  const storageKey = `${safe(input.receipt.siteId)}/${safe(input.receipt.targetId)}/${safe(input.receipt.generationId)}.${extension(input.receipt.mimeType)}`;
  const fullPath = join(/* turbopackIgnore: true */ resolvePersistenceRoot(), MEDIA_DIRECTORY, storageKey);
  mkdirSync(dirname(fullPath), { recursive: true });
  if (!existsSync(fullPath)) writeFileSync(fullPath, input.bytes);
  const record: StoredRecord = { ...deepClone(input.receipt), storageKey, byteSize: input.bytes.length, wordpressMediaId: null, wordpressUrl: null };
  loaded.state.records.push(record);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return asset(record);
}

export function bindGeneratedContextualMediaWordPress(input: { generationId: string; mediaId: number; url: string }): GeneratedContextualAsset {
  const loaded = load();
  const record = loaded.state.records.find((candidate) => candidate.generationId === input.generationId);
  if (!record || !Number.isSafeInteger(input.mediaId) || input.mediaId < 1 || !input.url.trim()) throw new Error("GENERATED_CONTEXTUAL_MEDIA_WORDPRESS_BINDING_INVALID");
  if (record.wordpressMediaId && (record.wordpressMediaId !== input.mediaId || record.wordpressUrl !== input.url)) throw new Error("GENERATED_CONTEXTUAL_MEDIA_WORDPRESS_BINDING_COLLISION");
  record.wordpressMediaId = input.mediaId; record.wordpressUrl = input.url.trim();
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return asset(record);
}

export function listGeneratedContextualMedia(input: { organizationId: string; siteId: string; targetId?: string }): readonly Omit<StoredRecord, "storageKey">[] {
  return deepClone(load().state.records.filter((record) => record.organizationId === input.organizationId && record.siteId === input.siteId && (!input.targetId || record.targetId === input.targetId)).map(({ storageKey, ...record }) => { void storageKey; return record; }));
}