import { existsSync, readFileSync } from "node:fs";

export function postgresClientConfig(environment = process.env) {
  const host = environment.DB_HOST?.trim();
  const database = environment.DB_NAME?.trim();
  const user = environment.DB_USERNAME?.trim();
  const password = environment.DB_PASSWORD;
  const port = Number(environment.DB_PORT?.trim() || "5432");
  if (!host || !database || !user || !password || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PostgreSQL requires valid DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, and DB_PASSWORD configuration.");
  }

  const configuredCa = environment.GENESIS_RDS_CA_CERT?.trim();
  let ca;
  if (configuredCa) {
    ca = configuredCa.includes("-----BEGIN CERTIFICATE-----")
      ? configuredCa
      : existsSync(configuredCa)
        ? readFileSync(configuredCa, "utf8")
        : undefined;
    if (!ca) {
      throw new Error("GENESIS_RDS_CA_CERT must contain a PEM certificate or reference an existing PEM file.");
    }
  }

  return {
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    application_name: "genesis-persistence-maintenance",
  };
}
