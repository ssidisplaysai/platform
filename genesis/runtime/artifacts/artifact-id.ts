import { createHash, randomUUID } from "node:crypto";

export function createArtifactUuid(
  deterministicSeed?: string,
): string {
  if (!deterministicSeed) {
    return randomUUID();
  }

  const hash = createHash("sha256")
    .update(deterministicSeed)
    .digest("hex")
    .slice(0, 32);

  const segment1 = hash.slice(0, 8);
  const segment2 = hash.slice(8, 12);
  const segment3 = `4${hash.slice(13, 16)}`;
  const segment4 = `a${hash.slice(17, 20)}`;
  const segment5 = hash.slice(20, 32);

  return `${segment1}-${segment2}-${segment3}-${segment4}-${segment5}`;
}

export function createArtifactDisplayId(
  sequence: number,
): string {
  const normalized = Number.isFinite(sequence) && sequence > 0
    ? Math.floor(sequence)
    : 1;

  return `ART-${String(normalized).padStart(8, "0")}`;
}
