import type {
  GenesisCompiler,
} from "../core";

import type {
  WorkbookInventory,
  WorkbookManifest,
} from "./types";

import {
  ArtifactWriter,
} from "../core";

import {
  ValidationError,
} from "../core";

import type {
  CompilerContext,
  CompilerResult,
} from "../core";

import {
  InventoryCompiler,
} from "./InventoryCompiler";

export class WorkbookCompiler
  implements GenesisCompiler<WorkbookManifest, WorkbookInventory>
{
  readonly id = "WorkbookCompiler";

  readonly version = "1.0.0";

  readonly description = "Compiles workbook metadata into deterministic inventory.";

  async validate(input: WorkbookManifest): Promise<void> {

    if (!input.sheets.length) {
      throw new ValidationError(
        "Workbook contains no worksheets.",
        this.id
      );
    }
  }

  async compile(
    input: WorkbookManifest,
    context: CompilerContext
  ): Promise<CompilerResult<WorkbookInventory>> {

    await this.validate(input);

    const inventory =
      new InventoryCompiler().compile(input);

    const writer =
      new ArtifactWriter(context.artifactRoot);

    const artifact =
      await writer.writeJson(
        "workbook/workbook-inventory.json",
        inventory
      );

    return {
      success: true,
      output: inventory,
      diagnostics: [],
      artifacts: [
        {
          type: "WorkbookInventory",
          path: artifact.path,
          sha256: artifact.sha256,
        },
      ],
    };
  }
}
