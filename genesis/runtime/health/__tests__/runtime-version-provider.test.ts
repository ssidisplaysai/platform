import { describe, expect, it } from "@jest/globals";

import {
  CompilerRegistry,
  createDefaultCompilerRegistry,
} from "../compiler-registry";
import { RuntimeVersionProvider } from "../runtime-version-provider";

describe("RuntimeVersionProvider", () => {
  it("resolves recommended environment metadata", () => {
    const registry = createDefaultCompilerRegistry();
    const provider = new RuntimeVersionProvider({
      GENESIS_RUNTIME_VERSION: "2.0.0",
      GENESIS_COMPILER_VERSION: "2.1.0",
      GENESIS_API_VERSION: "v2",
      GENESIS_BUILD_DATE: "2026-07-20",
      GENESIS_GIT_COMMIT: "abc1234",
      GENESIS_ENVIRONMENT: "staging",
    });

    expect(provider.resolve(registry)).toEqual({
      runtime: "Genesis Runtime",
      version: "2.0.0",
      compilerVersion: "2.1.0",
      apiVersion: "v2",
      buildDate: "2026-07-20",
      gitCommit: "abc1234",
      environment: "staging",
    });
  });

  it("falls back to registry and defaults when env vars are absent", () => {
    const registry = createDefaultCompilerRegistry();
    const provider = new RuntimeVersionProvider({});

    expect(provider.resolve(registry)).toEqual({
      runtime: "Genesis Runtime",
      version: "1.0.0",
      compilerVersion: "1.0.0",
      apiVersion: "v1",
      buildDate: "unknown",
      gitCommit: "unknown",
      environment: "development",
    });
  });

  it("supports backward-compatible API version env key", () => {
    const registry = new CompilerRegistry();

    registry.register({
      id: "workbook",
      name: "Workbook Compiler",
      version: "3.0.0",
      description: "Workbook compiler",
      author: "Genesis Runtime Team",
      inputTypes: ["GoogleWorkbookMetadata"],
      outputTypes: ["WorkbookManifest", "WorkbookInventory"],
      artifactTypes: ["WorkbookInventory"],
      capabilities: ["deterministic-compilation"],
      async compile() {
        return {};
      },
    });

    const provider = new RuntimeVersionProvider({
      GENESIS_RUNTIME_API_VERSION: "legacy-v3",
      NODE_ENV: "test",
    });

    expect(provider.resolve(registry).apiVersion).toBe("legacy-v3");
    expect(provider.resolve(registry).compilerVersion).toBe("3.0.0");
    expect(provider.resolve(registry).environment).toBe("test");
  });
});
