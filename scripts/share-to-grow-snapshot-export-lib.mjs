import { createHash } from "node:crypto";
import { FOUNDATION_STATE_COLLECTIONS, validateFoundationStateEnvelope } from "./foundation-state-envelope.mjs";

export const SHARE_TO_GROW_NAMESPACE = "share-to-grow-repository";
export const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{5,63}$/;
export const EXPORT_KEY_PATTERN = /^exports\/[a-z0-9-]+\/(postgres|filesystem)\.snapshot\.json$/;

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Utf8(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeEnvelope(rawSnapshot) {
  if (
    rawSnapshot
    && typeof rawSnapshot === "object"
    && rawSnapshot.envelope
    && typeof rawSnapshot.envelope === "object"
  ) {
    return normalizeEnvelope(rawSnapshot.envelope);
  }
  if (
    rawSnapshot
    && typeof rawSnapshot === "object"
    && Number.isSafeInteger(rawSnapshot.schemaVersion)
    && Number.isSafeInteger(rawSnapshot.revision)
    && typeof rawSnapshot.updatedAt === "string"
    && rawSnapshot.data
    && typeof rawSnapshot.data === "object"
    && !Array.isArray(rawSnapshot.data)
  ) {
    return rawSnapshot;
  }
  if (
    rawSnapshot
    && typeof rawSnapshot === "object"
    && Number.isSafeInteger(rawSnapshot.schema_version)
    && typeof rawSnapshot.revision !== "undefined"
    && typeof rawSnapshot.updated_at === "string"
    && rawSnapshot.data
    && typeof rawSnapshot.data === "object"
    && !Array.isArray(rawSnapshot.data)
  ) {
    const revision = Number(rawSnapshot.revision);
    if (!Number.isSafeInteger(revision)) throw new Error("SNAPSHOT_REVISION_INVALID");
    return {
      schemaVersion: rawSnapshot.schema_version,
      revision,
      updatedAt: rawSnapshot.updated_at,
      data: rawSnapshot.data,
    };
  }
  throw new Error("SNAPSHOT_ENVELOPE_INVALID");
}

export function validateRunId(runId) {
  if (!RUN_ID_PATTERN.test(runId ?? "")) {
    throw new Error("RUN_ID_INVALID");
  }
}

export function validateExportObjectKey(key, runId) {
  if (!EXPORT_KEY_PATTERN.test(key ?? "")) {
    throw new Error("EXPORT_OBJECT_KEY_INVALID");
  }
  if (!key.startsWith(`exports/${runId}/`)) {
    throw new Error("EXPORT_OBJECT_KEY_RUN_SCOPE_INVALID");
  }
}

export function buildSnapshotMetadata({ backend, namespace, envelope, rawText, capturedAt }) {
  const counts = validateFoundationStateEnvelope(envelope);
  const canonicalData = stableJson(envelope.data);
  return {
    backend,
    namespace,
    capturedAt,
    schemaVersion: envelope.schemaVersion,
    revision: envelope.revision,
    updatedAt: envelope.updatedAt,
    rawSha256: sha256Utf8(rawText),
    canonicalSha256: sha256Utf8(canonicalData),
    counts,
  };
}

export function buildSanitizedExportReport({ runId, namespace, bucket, kmsKeyArn, snapshots }) {
  const report = {
    mode: "READ_ONLY_SNAPSHOT_EXPORT",
    runId,
    namespace,
    bucket,
    kmsKeyArn,
    collections: FOUNDATION_STATE_COLLECTIONS,
    snapshots: snapshots.map((snapshot) => ({
      backend: snapshot.backend,
      schemaVersion: snapshot.schemaVersion,
      revision: snapshot.revision,
      updatedAt: snapshot.updatedAt,
      rawSha256: snapshot.rawSha256,
      canonicalSha256: snapshot.canonicalSha256,
      counts: snapshot.counts,
      objectKey: snapshot.objectKey,
      objectVersionId: snapshot.objectVersionId ?? null,
      objectETag: snapshot.objectETag ?? null,
    })),
  };
  return report;
}

