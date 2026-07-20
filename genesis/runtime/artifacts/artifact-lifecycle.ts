export type ArtifactStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "ARCHIVED"
  | "INVALID"
  | "FAILED";

const VALID_ARTIFACT_STATUSES: readonly ArtifactStatus[] = [
  "ACTIVE",
  "SUPERSEDED",
  "ARCHIVED",
  "INVALID",
  "FAILED",
];

export function isArtifactStatus(
  value: string,
): value is ArtifactStatus {
  return (VALID_ARTIFACT_STATUSES as readonly string[]).includes(
    value,
  );
}
