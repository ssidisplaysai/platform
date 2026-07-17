import type { WorkbookManifest } from "./types";

export class ManifestCompiler {
  public compile(manifest: WorkbookManifest): WorkbookManifest {
    return {
      ...manifest,
      sheets: [...manifest.sheets].sort((a, b) => a.index - b.index),
    };
  }
}
