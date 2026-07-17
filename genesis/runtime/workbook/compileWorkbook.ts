import { readFile } from "node:fs/promises";

import { WorkbookCompilationService } from "../../services/workbook-compilation";

import type {
  CompileWorkbookRequest,
  CompileWorkbookResponse,
} from "./types";

export async function compileWorkbook(
  request: CompileWorkbookRequest,
): Promise<CompileWorkbookResponse> {
  const runId = request.runId?.trim() || "workbook-runtime";

  const result = await new WorkbookCompilationService().compile({
    workbook: request.workbook,
    artifactRoot: request.artifactRoot,
  });

  const inventoryJson = await readFile(
    result.inventoryPath,
    "utf8",
  );

  return {
    success: true,
    runId,
    manifest: result.manifest,
    inventory: JSON.parse(inventoryJson),
    artifact: {
      path: result.inventoryPath,
      sha256: result.sha256,
    },
  };
}
