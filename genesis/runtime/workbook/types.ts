import type { GoogleWorkbookMetadata } from "../../adapters/google-sheets";
import type { WorkbookInventory, WorkbookManifest } from "../../compilers/workbook";

export interface CompileWorkbookRequest {
  readonly workbook: GoogleWorkbookMetadata;
  readonly artifactRoot: string;
  readonly runId?: string;
}

export interface WorkbookCompilationOutput {
  readonly runId: string;
  readonly manifest: WorkbookManifest;
  readonly inventory: WorkbookInventory;
}

export interface CompileWorkbookArtifact {
  readonly path: string;
  readonly sha256: string;
}

export interface CompileWorkbookResponse {
  readonly success: true;
  readonly runId: string;
  readonly manifest: WorkbookManifest;
  readonly inventory: WorkbookInventory;
  readonly artifact: CompileWorkbookArtifact;
}
