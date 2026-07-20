import { ArtifactManager } from "../artifacts";
import { RuntimeCompilerService } from "../compiler";
import {
  ArtifactGraphService,
  resolveGraphRoot,
} from "../graph";
import { createDefaultCompilerRegistry } from "../health/compiler-registry";

import type {
  CompileWorkbookRequest,
  CompileWorkbookResponse,
  WorkbookCompilationOutput,
} from "./types";

export async function compileWorkbook(
  request: CompileWorkbookRequest,
): Promise<CompileWorkbookResponse> {
  const sheetCount = request.workbook.sheets?.length ?? 0;

  const artifactManager = ArtifactManager.createLocal(
    request.artifactRoot,
  );
  const artifactGraphService = ArtifactGraphService.createLocal(
    resolveGraphRoot(request.artifactRoot),
  );
  const runtimeCompilerService = new RuntimeCompilerService(
    createDefaultCompilerRegistry(),
    artifactManager,
    artifactGraphService,
  );

  const result = await runtimeCompilerService.compile<
    CompileWorkbookRequest,
    WorkbookCompilationOutput
  >({
    compiler: "workbook",
    input: request,
    artifactType: "WorkbookInventory",
    artifactMetadata: {
      name: `Workbook ${request.workbook.spreadsheetId}`,
      description: "Workbook compiler output artifact.",
      environment: process.env.GENESIS_ENVIRONMENT || process.env.NODE_ENV || "development",
      tags: ["runtime", "workbook"],
    },
    inputSummary: {
      spreadsheetId: request.workbook.spreadsheetId,
      sheetCount,
    },
    outputSummary: {
      sheetCount,
    },
  });

  return {
    success: true,
    runId: result.output.runId,
    manifest: result.output.manifest,
    inventory: result.output.inventory,
    artifact: {
      path: artifactManager.getPayloadPath(result.artifact.id),
      sha256: result.artifact.sha256,
    },
  };
}
