import { randomBytes } from "node:crypto";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function writePostgresAppSecretPayload(filePath, username, database) {
  if (!filePath || !username || !database) {
    throw new Error("secret payload path, username, and database are required");
  }
  const password = randomBytes(32).toString("hex");
  const payload = JSON.stringify({ username, database, password });
  const handle = await open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(payload, { encoding: "utf8" });
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [, , filePath, username, database] = process.argv;
    await writePostgresAppSecretPayload(filePath, username, database);
  } catch {
    console.error("Unable to write the staging PostgreSQL secret payload");
    process.exitCode = 1;
  }
}
