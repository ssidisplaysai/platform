import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  ALLOWED_FAILURE_CODES,
  parseDiagnosticModeArg,
  runAdminReadOnlyDiagnostic,
} from "./s2g-db-admin-diagnostic-lib.mjs";

export { parseDiagnosticModeArg, runAdminReadOnlyDiagnostic } from "./s2g-db-admin-diagnostic-lib.mjs";

async function main(argv = process.argv.slice(2), environment = process.env) {
  parseDiagnosticModeArg(argv);
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
    const code = typeof error?.code === "string" && ALLOWED_FAILURE_CODES.has(error.code)
      ? error.code
      : "DIAGNOSTIC_FAILED";
    console.error(`S2G_DB_ROLE_PROVISION=FAIL code=${code}`);
    process.exitCode = 1;
  });
}

