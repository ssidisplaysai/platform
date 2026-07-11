/**
 * ArtifactWriter
 *
 * Writes artifact records to the file system.
 *
 * Modes:
 * - dry-run: Plans artifacts but writes nothing
 * - write: Actually writes artifacts to file system
 *
 * Rules:
 * - If mode is dry-run, files are not written
 * - If mode is write, files are written to targetPath
 * - Directories are created as needed
 * - Existing files are skipped unless force is true
 * - Returns immutable WriteResult
 */

import fs from "fs";
import path from "path";
import { createWriteResult } from "./WriteResult.mjs";

export function writeArtifacts(context) {
  const {
    rootDir,
    artifacts = [],
    mode = "dry-run",
    force = false,
  } = context;

  // Validate context
  if (!rootDir) throw new Error("writeArtifacts: rootDir is required");
  if (!Array.isArray(artifacts)) throw new Error("writeArtifacts: artifacts must be an array");
  if (mode !== "dry-run" && mode !== "write") {
    throw new Error(`writeArtifacts: mode must be "dry-run" or "write", got "${mode}"`);
  }

  let written = 0;
  let skipped = 0;
  const processedArtifacts = [];
  const diagnostics = [];

  // Process each artifact
  for (const artifact of artifacts) {
    let status = artifact.status;
    let diagnostic = null;

    // In dry-run mode, mark as planned
    if (mode === "dry-run") {
      status = "planned";
      diagnostic = {
        level: "info",
        code: "ARTIFACT_PLANNED",
        message: `Artifact planned: ${artifact.name}`,
        stepId: artifact.stepId,
        timestamp: new Date().toISOString(),
      };
    }
    // In write mode, try to write the file
    else if (mode === "write") {
      try {
        const fullPath = path.resolve(rootDir, artifact.targetPath);
        const dirPath = path.dirname(fullPath);

        // Check if file already exists
        if (fs.existsSync(fullPath) && !force) {
          status = "skipped";
          skipped++;
          diagnostic = {
            level: "warning",
            code: "ARTIFACT_SKIPPED",
            message: `File already exists, skipping: ${artifact.targetPath}`,
            stepId: artifact.stepId,
            timestamp: new Date().toISOString(),
          };
        } else {
          // Create directory if needed
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          // Write the file
          fs.writeFileSync(fullPath, artifact.content, "utf-8");
          status = "written";
          written++;
          diagnostic = {
            level: "info",
            code: "ARTIFACT_WRITTEN",
            message: `Artifact written: ${artifact.targetPath}`,
            stepId: artifact.stepId,
            timestamp: new Date().toISOString(),
          };
        }
      } catch (error) {
        status = "error";
        diagnostic = {
          level: "error",
          code: "ARTIFACT_WRITE_ERROR",
          message: `Failed to write artifact: ${error.message}`,
          stepId: artifact.stepId,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Update artifact record with new status
    const processedArtifact = Object.freeze({
      ...artifact,
      status,
    });
    processedArtifacts.push(processedArtifact);

    if (diagnostic) {
      diagnostics.push(diagnostic);
    }
  }

  // Determine success (no errors in write mode)
  const hasErrors = diagnostics.some(d => d.level === "error");
  const success = !hasErrors;

  return createWriteResult({
    success,
    mode,
    written,
    skipped,
    artifacts: processedArtifacts,
    diagnostics,
  });
}
