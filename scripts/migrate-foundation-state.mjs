import { runner } from "node-pg-migrate";
import { postgresClientConfig } from "./postgres-connection.mjs";

const direction = process.argv[2] ?? "up";
if (direction !== "up" && direction !== "down") {
  throw new Error("Usage: node scripts/migrate-foundation-state.mjs <up|down>");
}

if (process.env.GENESIS_ENVIRONMENT === "production") {
  throw new Error("Production migrations are prohibited by this command.");
}

await runner({
  databaseUrl: postgresClientConfig(),
  direction,
  dir: "migrations",
  migrationsTable: "genesis_schema_migrations",
  schema: "public",
  createSchema: false,
  createMigrationsSchema: false,
  checkOrder: true,
  singleTransaction: true,
});
