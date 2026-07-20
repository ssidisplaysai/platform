import { access } from "node:fs/promises";

import { resolveWorkbookRuntimeConfig } from "../workbook";

import type { RuntimeStatus } from "./runtime-status";
import type { RuntimeVersion } from "./version";
import { RuntimeVersionProvider } from "./runtime-version-provider";
import type {
  CompilerRegistration,
  CompilerRegistry,
} from "./compiler-registry";

type RuntimeEnvironment = Readonly<
  Record<string, string | undefined>
>;

export interface RuntimeServiceStatus {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly registeredCompilers: readonly string[];
  readonly artifactRoot: string;
  readonly requests: {
    readonly maximumBytes: number;
  };
  readonly runtime: {
    readonly uptimeSeconds: number;
  };
}

interface RuntimeDiagnostics {
  readonly configured: boolean;
  readonly artifactStorage: "ok" | "error";
  readonly artifactRoot: string;
  readonly maximumRequestBytes: number;
}

const DEFAULT_MAXIMUM_REQUEST_BYTES = 1048576;

export class HealthService {
  private readonly runtimeVersionProvider: RuntimeVersionProvider;

  public constructor(
    private readonly compilerRegistry: CompilerRegistry,
    private readonly environment: RuntimeEnvironment = process.env,
  ) {
    this.runtimeVersionProvider = new RuntimeVersionProvider(
      this.environment,
    );
  }

  public async getHealth(): Promise<RuntimeStatus> {
    const diagnostics = await this.getDiagnostics();
    const compilerCount = this.compilerRegistry.list().length;
    const ready =
      diagnostics.configured &&
      diagnostics.artifactStorage === "ok" &&
      compilerCount > 0;

    return {
      status: this.resolveHealthState(
        diagnostics,
        compilerCount,
      ),
      ready,
      uptimeSeconds: this.getUptimeSeconds(),
      artifactStorage: diagnostics.artifactStorage,
      timestamp: this.createTimestamp(),
    };
  }

  public getVersion(): RuntimeVersion {
    return this.runtimeVersionProvider.resolve(
      this.compilerRegistry,
    );
  }

  public async getStatus(): Promise<RuntimeServiceStatus> {
    const diagnostics = await this.getDiagnostics();
    const registeredCompilers = this.compilerRegistry
      .list()
      .map((compiler: CompilerRegistration) =>
        this.toStatusCompilerName(compiler.id),
      );

    return {
      status: this.resolveHealthState(
        diagnostics,
        registeredCompilers.length,
      ),
      registeredCompilers,
      artifactRoot: diagnostics.artifactRoot,
      requests: {
        maximumBytes: diagnostics.maximumRequestBytes,
      },
      runtime: {
        uptimeSeconds: this.getUptimeSeconds(),
      },
    };
  }

  private async getDiagnostics(): Promise<RuntimeDiagnostics> {
    try {
      const configuration = resolveWorkbookRuntimeConfig(
        this.environment,
      );

      const artifactStorage =
        await this.validateArtifactStorage(
          configuration.artifactRoot,
        );

      return {
        configured: true,
        artifactStorage,
        artifactRoot: configuration.artifactRoot,
        maximumRequestBytes:
          configuration.maximumRequestBytes,
      };
    } catch {
      return {
        configured: false,
        artifactStorage: "error",
        artifactRoot: "unconfigured",
        maximumRequestBytes:
          this.resolveConfiguredRequestLimit(),
      };
    }
  }

  private resolveConfiguredRequestLimit(): number {
    const configuredLimit = Number(
      this.environment.GENESIS_RUNTIME_MAX_REQUEST_BYTES ??
        DEFAULT_MAXIMUM_REQUEST_BYTES,
    );

    if (!Number.isFinite(configuredLimit) || configuredLimit <= 0) {
      return DEFAULT_MAXIMUM_REQUEST_BYTES;
    }

    return configuredLimit;
  }

  private async validateArtifactStorage(
    artifactRoot: string,
  ): Promise<"ok" | "error"> {
    try {
      await access(artifactRoot);
      return "ok";
    } catch {
      return "error";
    }
  }

  private resolveHealthState(
    diagnostics: RuntimeDiagnostics,
    registeredCompilerCount: number,
  ): "healthy" | "degraded" | "unhealthy" {
    if (!diagnostics.configured) {
      return "unhealthy";
    }

    if (
      diagnostics.artifactStorage === "ok" &&
      registeredCompilerCount > 0
    ) {
      return "healthy";
    }

    return "degraded";
  }

  private getUptimeSeconds(): number {
    return Math.floor(process.uptime());
  }

  private createTimestamp(): string {
    return new Date().toISOString();
  }

  private toStatusCompilerName(id: string): string {
    const normalized = id.trim().toLowerCase();

    if (!normalized) {
      return "Unknown";
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}
