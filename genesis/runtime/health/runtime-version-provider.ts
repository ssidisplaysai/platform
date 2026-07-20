import type { CompilerRegistry } from "./compiler-registry";
import type { RuntimeVersion } from "./version";

type RuntimeEnvironment = Readonly<
  Record<string, string | undefined>
>;

const DEFAULT_RUNTIME_VERSION = "1.0.0";
const DEFAULT_API_VERSION = "v1";
const DEFAULT_COMPILER_VERSION = "1.0.0";
const DEFAULT_BUILD_DATE = "unknown";
const DEFAULT_GIT_COMMIT = "unknown";
const DEFAULT_ENVIRONMENT = "development";

export class RuntimeVersionProvider {
  public constructor(
    private readonly environment: RuntimeEnvironment = process.env,
  ) {}

  public resolve(
    compilerRegistry: CompilerRegistry,
  ): RuntimeVersion {
    const workbookCompiler = compilerRegistry.resolve("workbook");

    return {
      runtime: "Genesis Runtime",
      version:
        this.environment.GENESIS_RUNTIME_VERSION?.trim() ||
        DEFAULT_RUNTIME_VERSION,
      compilerVersion:
        this.environment.GENESIS_COMPILER_VERSION?.trim() ||
        workbookCompiler?.version ||
        DEFAULT_COMPILER_VERSION,
      apiVersion:
        this.environment.GENESIS_API_VERSION?.trim() ||
        this.environment.GENESIS_RUNTIME_API_VERSION?.trim() ||
        DEFAULT_API_VERSION,
      buildDate:
        this.environment.GENESIS_BUILD_DATE?.trim() ||
        DEFAULT_BUILD_DATE,
      gitCommit:
        this.environment.GENESIS_GIT_COMMIT?.trim() ||
        DEFAULT_GIT_COMMIT,
      environment:
        this.environment.GENESIS_ENVIRONMENT?.trim() ||
        this.environment.NODE_ENV?.trim() ||
        DEFAULT_ENVIRONMENT,
    };
  }
}
