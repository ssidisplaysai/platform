import { FoundationPersistenceError } from "./foundation-persistence";

export type FoundationPersistenceBackend = "filesystem" | "postgres";

function environmentName(environment: NodeJS.ProcessEnv): string {
  return environment.GENESIS_ENVIRONMENT?.trim() ?? "";
}

export function resolveFoundationPersistenceBackend(
  environment: NodeJS.ProcessEnv = process.env,
): FoundationPersistenceBackend {
  const configured = environment.GENESIS_STATE_BACKEND?.trim();
  const runtimeEnvironment = environmentName(environment);

  if (!configured) {
    if (runtimeEnvironment === "production") {
      throw new FoundationPersistenceError(
        "GENESIS_STATE_BACKEND must be set to 'postgres' when GENESIS_ENVIRONMENT=production.",
        "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION",
      );
    }
    return "filesystem";
  }

  if (configured !== "filesystem" && configured !== "postgres") {
    throw new FoundationPersistenceError(
      `Unsupported GENESIS_STATE_BACKEND value: ${configured}.`,
      "PERSISTENCE_BACKEND_UNSUPPORTED",
    );
  }

  if (runtimeEnvironment === "production" && configured !== "postgres") {
    throw new FoundationPersistenceError(
      "GENESIS_STATE_BACKEND must be set to 'postgres' when GENESIS_ENVIRONMENT=production.",
      "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION",
    );
  }

  return configured;
}

export function assertProductionPostgresRuntimeConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (environmentName(environment) !== "production") return;

  const backend = environment.GENESIS_STATE_BACKEND?.trim();
  if (backend !== "postgres") {
    throw new FoundationPersistenceError(
      "GENESIS_STATE_BACKEND must be set to 'postgres' when GENESIS_ENVIRONMENT=production.",
      "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION",
    );
  }

  const host = environment.DB_HOST?.trim();
  const database = environment.DB_NAME?.trim();
  const user = environment.DB_USERNAME?.trim();
  const password = environment.DB_PASSWORD;
  const rawPort = environment.DB_PORT?.trim() || "5432";
  const port = Number(rawPort);
  if (!host || !database || !user || !password || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new FoundationPersistenceError(
      "PostgreSQL persistence requires valid DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, and DB_PASSWORD configuration.",
      "PERSISTENCE_DATABASE_CONFIGURATION_INVALID",
    );
  }

  if (!environment.GENESIS_RDS_CA_CERT?.trim()) {
    throw new FoundationPersistenceError(
      "GENESIS_RDS_CA_CERT is required when GENESIS_ENVIRONMENT=production and GENESIS_STATE_BACKEND=postgres.",
      "PERSISTENCE_TLS_CONFIGURATION_REQUIRED_IN_PRODUCTION",
    );
  }
}
