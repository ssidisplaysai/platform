import { GoogleSheetsAdapter } from "../../adapters/google-sheets";
import {
  ManifestCompiler,
  WorkbookCompiler,
} from "../../compilers/workbook";

import type {
  WorkbookCompilationRequest,
  WorkbookCompilationResponse,
} from "./types";

import type { CompilerContext } from "../../compilers/core";

export class WorkbookCompilationService {
  public async compile(
    request: WorkbookCompilationRequest,
  ): Promise<WorkbookCompilationResponse> {

    const adapter = new GoogleSheetsAdapter();

    const manifest =
      new ManifestCompiler().compile(
        adapter.adapt(request.workbook),
      );

    const context: CompilerContext = {
      runId: "runtime",
      artifactRoot: request.artifactRoot,
      deterministic: true,
      logger: {
        info() {},
        warn() {},
        error() {},
      },
    };

    const result =
      await new WorkbookCompiler().compile(
        manifest,
        context,
      );

    return {
      manifest,
      inventoryPath: result.artifacts[0]!.path,
      sha256: result.artifacts[0]!.sha256!,
    };
  }
}
