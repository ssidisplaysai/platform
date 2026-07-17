import type { WorkbookManifest } from "../../compilers/workbook";
import type { GoogleWorkbookMetadata } from "../../adapters/google-sheets";

export interface WorkbookCompilationRequest {
  readonly workbook: GoogleWorkbookMetadata;
  readonly artifactRoot: string;
}

export interface WorkbookCompilationResponse {
  readonly manifest: WorkbookManifest;
  readonly inventoryPath: string;
  readonly sha256: string;
}
