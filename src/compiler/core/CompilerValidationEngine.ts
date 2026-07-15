import type { CompilerArtifact, CompilerDiagnostic, CompilerManifest, CompilerPassMetadata } from "./types";

export class CompilerValidationEngine {
  validatePassContracts(passMetadata: CompilerPassMetadata[]): CompilerDiagnostic[] {
    const diagnostics: CompilerDiagnostic[] = [];
    const ids = new Set<string>();

    for (const metadata of passMetadata) {
      if (ids.has(metadata.id)) {
        diagnostics.push({
          code: "DUPLICATE_PASS_ID",
          severity: "error",
          message: `Duplicate pass id: ${metadata.id}`,
          passId: metadata.id,
        });
      }

      ids.add(metadata.id);

      if (!metadata.version) {
        diagnostics.push({
          code: "MISSING_PASS_VERSION",
          severity: "error",
          message: `Pass ${metadata.id} is missing version`,
          category: "configuration",
          passId: metadata.id,
        });
      }
    }

    return diagnostics;
  }

  validateArtifacts(artifacts: CompilerArtifact[]): CompilerDiagnostic[] {
    const diagnostics: CompilerDiagnostic[] = [];

    for (const artifact of artifacts) {
      if (!artifact.checksum || artifact.checksum.length !== 64) {
        diagnostics.push({
          code: "INVALID_ARTIFACT_CHECKSUM",
          severity: "error",
          message: `Invalid checksum for artifact ${artifact.id}`,
          category: "validation",
          artifactId: artifact.id,
        });
      }

      if (!artifact.sessionId) {
        diagnostics.push({
          code: "MISSING_ARTIFACT_SESSION",
          severity: "error",
          message: `Artifact ${artifact.id} missing session id`,
          category: "validation",
          artifactId: artifact.id,
        });
      }
    }

    return diagnostics;
  }

  validateManifest(manifest: CompilerManifest): CompilerDiagnostic[] {
    const diagnostics: CompilerDiagnostic[] = [];

    if (!manifest.sessionId) {
      diagnostics.push({
        code: "MISSING_MANIFEST_SESSION",
        severity: "error",
        message: "Manifest missing session id",
        category: "validation",
      });
    }

    if (!manifest.checksum || manifest.checksum.length !== 64) {
      diagnostics.push({
        code: "INVALID_MANIFEST_CHECKSUM",
        severity: "error",
        message: "Manifest checksum is invalid",
        category: "validation",
      });
    }

    return diagnostics;
  }
}
