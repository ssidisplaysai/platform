import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "@jest/globals";

import { ArtifactManager } from "../../artifacts";
import { CompilerRegistry } from "../../health/compiler-registry";

import {
  RuntimeCompilerService,
  type GenesisCompiler,
} from "..";

function createEchoCompiler(): GenesisCompiler<
  { readonly value: string },
  { readonly echoed: string }
> {
  return {
    id: "echo",
    name: "Echo Compiler",
    version: "1.0.0",
    description: "Echo test compiler",
    author: "Genesis Runtime Team",
    inputTypes: ["EchoInput"],
    outputTypes: ["EchoOutput"],
    artifactTypes: ["EchoArtifact"],
    capabilities: ["echo"],
    async compile(input) {
      return { echoed: input.value };
    },
  };
}

describe("RuntimeCompilerService", () => {
  const temporaryDirectories: string[] = [];

  async function createService(
    registry: CompilerRegistry,
  ): Promise<RuntimeCompilerService> {
    const artifactRoot = await mkdtemp(
      join(tmpdir(), "genesis-runtime-compiler-"),
    );
    temporaryDirectories.push(artifactRoot);

    return new RuntimeCompilerService(
      registry,
      ArtifactManager.createLocal(artifactRoot),
      undefined,
      "1.0.0",
    );
  }

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it("compiles with a registered compiler", async () => {
    const registry = new CompilerRegistry();
    registry.register(createEchoCompiler());

    const service = await createService(registry);
    const result = await service.compile({
      compiler: "echo",
      input: { value: "ok" },
    });

    expect(result.output).toEqual({ echoed: "ok" });
    expect(result.artifact.type).toBe("EchoArtifact");
    expect(result.artifact.sha256).toHaveLength(64);
  });

  it("rejects unknown compiler ids", async () => {
    const service = await createService(new CompilerRegistry());

    await expect(
      service.compile({
        compiler: "missing",
        input: { value: "nope" },
      }),
    ).rejects.toThrow("is not registered");
  });
});
