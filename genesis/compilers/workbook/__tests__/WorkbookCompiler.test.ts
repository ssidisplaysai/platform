import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import type { CompilerContext } from "../../core";
import { ValidationError } from "../../core";
import { WorkbookCompiler } from "../WorkbookCompiler";
import type { WorkbookManifest } from "../types";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  jest.restoreAllMocks();

  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("WorkbookCompiler", () => {
  it("compiles and writes a deterministic workbook artifact", async () => {
    jest
      .spyOn(Date.prototype, "toISOString")
      .mockReturnValue("2026-07-16T00:00:00.000Z");

    const artifactRoot = await mkdtemp(
      join(tmpdir(), "genesis-workbook-compiler-"),
    );

    temporaryDirectories.push(artifactRoot);

    const context: CompilerContext = {
      runId: "run-001",
      artifactRoot,
      deterministic: true,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const manifest: WorkbookManifest = {
      spreadsheetId: "sheet-123",
      title: "Blog Automation Queue",
      sheets: [
        {
          id: 1,
          title: "PSheet1",
          index: 0,
          rowCount: 200,
          columnCount: 20,
        },
      ],
    };

    const result = await new WorkbookCompiler().compile(
      manifest,
      context,
    );

    expect(result.success).toBe(true);
    expect(result.output.sheetCount).toBe(1);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.sha256).toHaveLength(64);

    const artifactContent = await readFile(
      result.artifacts[0]!.path,
      "utf8",
    );

    expect(JSON.parse(artifactContent)).toEqual(result.output);
  });

  it("rejects a workbook with no worksheets", async () => {
    const compiler = new WorkbookCompiler();

    await expect(
      compiler.validate({
        spreadsheetId: "sheet-123",
        title: "Empty Workbook",
        sheets: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
