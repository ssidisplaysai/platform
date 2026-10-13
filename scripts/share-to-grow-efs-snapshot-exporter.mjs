import { readFile } from "node:fs/promises";
import {
  buildSnapshotMetadata,
  normalizeEnvelope,
  SHARE_TO_GROW_NAMESPACE,
} from "./share-to-grow-snapshot-export-lib.mjs";

export async function readFilesystemShareToGrowSnapshot({
  sourcePath,
  namespace = SHARE_TO_GROW_NAMESPACE,
  capturedAt = new Date().toISOString(),
}) {
  if (!sourcePath || typeof sourcePath !== "string") {
    throw new Error("FILESYSTEM_SNAPSHOT_SOURCE_PATH_REQUIRED");
  }
  const rawText = await readFile(sourcePath, "utf8");
  const envelope = normalizeEnvelope(JSON.parse(rawText));
  const metadata = buildSnapshotMetadata({
    backend: "filesystem",
    namespace,
    envelope,
    rawText,
    capturedAt,
  });
  return { envelope, rawText, metadata };
}

