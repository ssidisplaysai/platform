import type { CompilerConfiguration } from "./types";

export type CompilerConfigurationOverrides = Partial<Omit<CompilerConfiguration, "standards">> & {
  readonly standards?: Partial<CompilerConfiguration["standards"]>;
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const propertyValue of Object.values(value as Record<string, unknown>)) {
      deepFreeze(propertyValue);
    }
  }

  return value;
}

export const DEFAULT_COMPILER_CONFIGURATION: CompilerConfiguration = deepFreeze({
  compilerVersion: "1.0.0",
  pipelineVersion: "1.0.0",
  stopOnError: true,
  failOnValidationError: true,
  collectMetrics: true,
  publishEvents: true,
  maxDiagnostics: 100,
  deterministicTimestamps: false,
  standards: {
    gps0001: "1.0",
    gps0002: "1.0",
    eir0001: "1.0",
    bgs0001: "1.0",
    bgc0001: "1.0",
    gcc0001: "1.0",
  },
});

export function createCompilerConfiguration(
  overrides: CompilerConfigurationOverrides = {},
): CompilerConfiguration {
  return deepFreeze({
    ...DEFAULT_COMPILER_CONFIGURATION,
    ...overrides,
    standards: {
      ...DEFAULT_COMPILER_CONFIGURATION.standards,
      ...overrides.standards,
    },
  });
}