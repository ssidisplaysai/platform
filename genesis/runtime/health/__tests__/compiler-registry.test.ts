import { describe, expect, it } from "@jest/globals";

import {
  CompilerRegistry,
  createDefaultCompilerRegistry,
} from "../compiler-registry";
import type { GenesisCompiler } from "../../compiler";

function createCompiler(
  id: string,
  name: string,
  version = "1.0.0",
): GenesisCompiler<unknown, unknown> {
  return {
    id,
    name,
    version,
    description: `${name} compiler`,
    author: "Genesis Runtime Team",
    inputTypes: ["input"],
    outputTypes: ["output"],
    artifactTypes: ["artifact"],
    capabilities: ["compile"],
    async compile() {
      return {};
    },
  };
}

describe("CompilerRegistry", () => {
  it("registers and resolves compilers by id", () => {
    const registry = new CompilerRegistry();

    registry.register(createCompiler("workbook", "Workbook"));

    expect(registry.has("workbook")).toBe(true);
    expect(registry.resolve("workbook")?.name).toBe(
      "Workbook",
    );
  });

  it("resolves compilers by name", () => {
    const registry = new CompilerRegistry();

    registry.register(createCompiler("ocr", "OCR", "0.1.0"));

    expect(registry.resolve("ocr")?.id).toBe("ocr");
    expect(registry.resolve("OCR")?.id).toBe("ocr");
    expect(registry.has("OCR")).toBe(true);
  });

  it("lists compilers in deterministic sorted order", () => {
    const registry = new CompilerRegistry();

    registry.register(createCompiler("zeta", "Zeta", "1"));
    registry.register(createCompiler("alpha", "Alpha", "1"));

    expect(registry.list().map((compiler) => compiler.name)).toEqual([
      "Alpha",
      "Zeta",
    ]);
  });

  it("provides default workbook compiler registration", () => {
    const registry = createDefaultCompilerRegistry();

    expect(registry.has("workbook")).toBe(true);
    expect(registry.metadata("workbook")).toMatchObject({
      id: "workbook",
      name: "Workbook Compiler",
      version: "1.0.0",
    });
  });

  it("exposes metadata without executing compiler", () => {
    const registry = new CompilerRegistry();

    registry.register(createCompiler("pdf", "PDF Compiler"));

    const metadata = registry.metadata("pdf");

    expect(metadata).toMatchObject({
      id: "pdf",
      name: "PDF Compiler",
      capabilities: ["compile"],
    });
  });

  it("supports compiler removal", () => {
    const registry = new CompilerRegistry();

    registry.register(createCompiler("image", "Image Compiler"));

    expect(registry.has("image")).toBe(true);
    expect(registry.remove("image")).toBe(true);
    expect(registry.has("image")).toBe(false);
    expect(registry.remove("image")).toBe(false);
  });
});
