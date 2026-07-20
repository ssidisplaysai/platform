import type { GenesisCompiler } from "../compiler";

import {
  InventoryCompiler,
  ManifestCompiler,
} from "../../compilers/workbook";
import { GoogleSheetsAdapter } from "../../adapters/google-sheets";
import type {
  CompileWorkbookRequest,
  WorkbookCompilationOutput,
} from "./types";

export class WorkbookRuntimeCompiler
  implements
    GenesisCompiler<CompileWorkbookRequest, WorkbookCompilationOutput>
{
  public readonly id = "workbook";
  public readonly name = "Workbook Compiler";
  public readonly version = "1.0.0";
  public readonly description =
    "Compiles Google Workbook metadata into Genesis workbook artifacts.";
  public readonly author = "Genesis Runtime Team";
  public readonly inputTypes = [
    "GoogleWorkbookMetadata",
  ] as const;
  public readonly outputTypes = [
    "WorkbookManifest",
    "WorkbookInventory",
  ] as const;
  public readonly artifactTypes = [
    "WorkbookInventory",
  ] as const;
  public readonly capabilities = [
    "deterministic-compilation",
    "sha256-artifact-hashing",
    "manifest-generation",
    "inventory-generation",
  ] as const;

  public async compile(
    input: CompileWorkbookRequest,
  ): Promise<WorkbookCompilationOutput> {
    const manifest = new ManifestCompiler().compile(
      new GoogleSheetsAdapter().adapt(input.workbook),
    );

    if (!manifest.sheets.length) {
      throw new Error("Workbook contains no worksheets.");
    }

    const inventory = new InventoryCompiler().compile(manifest);

    return {
      runId: input.runId?.trim() || "workbook-runtime",
      manifest,
      inventory,
    };
  }
}
