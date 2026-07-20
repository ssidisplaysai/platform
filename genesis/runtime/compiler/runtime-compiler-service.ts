import type { CompilerRegistry } from "../health/compiler-registry";
import type {
  ArtifactManager,
  ArtifactMetadataInput,
  ArtifactDependencyReference,
  GenesisArtifact,
} from "../artifacts";
import type { ArtifactGraphService } from "../graph";
import type { GenesisCompiler } from "./genesis-compiler";

export interface RuntimeCompileRequest<TInput> {
  readonly compiler: string;
  readonly input: TInput;
  readonly artifactType?: string;
  readonly artifactVersion?: string;
  readonly artifactMetadata?: ArtifactMetadataInput;
  readonly dependencies?: readonly ArtifactDependencyReference[];
  readonly parentArtifacts?: readonly string[];
  readonly deterministicSeed?: string;
  readonly inputSummary?: Readonly<Record<string, unknown>>;
  readonly outputSummary?: Readonly<Record<string, unknown>>;
}

export interface RuntimeCompileResult<TOutput> {
  readonly output: TOutput;
  readonly artifact: GenesisArtifact<TOutput>;
}

export class RuntimeCompilerService {
  public constructor(
    private readonly compilerRegistry: CompilerRegistry,
    private readonly artifactManager: ArtifactManager,
    private readonly artifactGraphService?: ArtifactGraphService,
    private readonly runtimeVersion =
      process.env.GENESIS_RUNTIME_VERSION?.trim() || "1.0.0",
  ) {}

  public async compile<TInput, TOutput>(
    request: RuntimeCompileRequest<TInput>,
  ): Promise<RuntimeCompileResult<TOutput>> {
    const compiler = this.compilerRegistry.resolve(
      request.compiler,
    ) as GenesisCompiler<TInput, TOutput> | null;

    if (!compiler) {
      throw new Error(
        `Compiler '${request.compiler}' is not registered.`,
      );
    }

    const output = await compiler.compile(request.input);

    const artifact = await this.artifactManager.create({
      type:
        request.artifactType ||
        compiler.artifactTypes[0] ||
        compiler.outputTypes[0] ||
        "CompilerOutput",
      version: request.artifactVersion || "1.0.0",
      compilerId: compiler.id,
      compilerVersion: compiler.version,
      runtimeVersion: this.runtimeVersion,
      payload: output,
      metadata: request.artifactMetadata,
      dependencies: request.dependencies,
      parentArtifacts: request.parentArtifacts,
      deterministicSeed: request.deterministicSeed,
      inputSummary: request.inputSummary,
      outputSummary: request.outputSummary,
    });

    await this.artifactManager.save(artifact);

    if (this.artifactGraphService) {
      await this.artifactGraphService.registerArtifact(artifact);
    }

    return {
      output,
      artifact,
    };
  }
}
