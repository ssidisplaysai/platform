import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { ALLOWED_FAILURE_CODES, runAdminReadOnlyDiagnostic } from "./s2g-db-admin-diagnostic-lib.mjs";
const ENTRYPOINT_FAILURE_CODES = new Set([...ALLOWED_FAILURE_CODES, "DIAGNOSTIC_ENTRYPOINT_ARGUMENTS_REJECTED"]);

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function parseEntrypointArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 0) throw failure("DIAGNOSTIC_ENTRYPOINT_ARGUMENTS_REJECTED");
}

async function main(argv = process.argv.slice(2), environment = process.env) {
  parseEntrypointArgs(argv);
  const report = await runAdminReadOnlyDiagnostic(environment);
  const safeReport = {
    ...report,
    namespaceSnapshot: report.namespaceSnapshot
      ? {
        namespace: report.namespaceSnapshot.namespace,
        schema_version: report.namespaceSnapshot.schema_version,
        revision: report.namespaceSnapshot.revision,
        updated_at: report.namespaceSnapshot.updated_at,
        data_md5: report.namespaceSnapshot.data_md5,
      }
      : null,
  };
  console.log(`S2G_DB_ADMIN_DIAGNOSTIC=PASS ${JSON.stringify(safeReport)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    const code = typeof error?.code === "string" && ENTRYPOINT_FAILURE_CODES.has(error.code)
      ? error.code
      : "DIAGNOSTIC_FAILED";
    console.error(`S2G_DB_ADMIN_DIAGNOSTIC=FAIL code=${code}`);
    process.exitCode = 1;
  });
}
