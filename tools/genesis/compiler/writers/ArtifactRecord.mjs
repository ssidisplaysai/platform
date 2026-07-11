/**
 * ArtifactRecord
 *
 * Represents a single generated artifact.
 *
 * Fields:
 * - id: unique identifier
 * - stepId: generation step that created this
 * - type: artifact type (entity, repository, service, etc.)
 * - name: human-readable artifact name
 * - targetPath: file path where artifact should be written
 * - content: the artifact content to write
 * - status: current status (planned, written, skipped)
 * - metadata: optional metadata
 */

export function createArtifactRecord(input) {
  const {
    id,
    stepId,
    type,
    name,
    targetPath,
    content,
    status = "planned",
    metadata = {},
  } = input;

  // Validate required fields
  if (!id) throw new Error("ArtifactRecord: id is required");
  if (!stepId) throw new Error("ArtifactRecord: stepId is required");
  if (!type) throw new Error("ArtifactRecord: type is required");
  if (!name) throw new Error("ArtifactRecord: name is required");
  if (!targetPath) throw new Error("ArtifactRecord: targetPath is required");
  if (content === undefined) throw new Error("ArtifactRecord: content is required");
  if (!status) throw new Error("ArtifactRecord: status is required");

  const record = {
    id,
    stepId,
    type,
    name,
    targetPath,
    content,
    status,
    metadata,
    createdAt: new Date().toISOString(),
  };

  // Freeze the record to ensure immutability
  return Object.freeze(record);
}
