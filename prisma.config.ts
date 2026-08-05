import { defineConfig } from "prisma/config";

const prismaDatasourceUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/genesis?schema=public";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: prismaDatasourceUrl,
  },
});
