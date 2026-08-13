# Genesis Platform 1.1 Environment Restoration

## Immutable release candidate

- SHA: 0bef398501a37096408c0c1c38043e3f8a72dfd3
- branch: release/genesis-platform-1.1
- SHA verified: YES
- release candidate modified: NO

## Step 1 — SHA verification

Observed from Git:

- git branch --show-current = release/genesis-platform-1.1
- git rev-parse HEAD = 0bef398501a37096408c0c1c38043e3f8a72dfd3

Result: PASS

## Step 2 — environment loading contract

Repository evidence shows that the production deployment path is expected to load .env through the PowerShell helper in [scripts/deploy-glw.ps1](scripts/deploy-glw.ps1), which reads the file and writes required values into the process environment before runtime startup.

The Prisma configuration in [prisma.config.ts](prisma.config.ts) requires DATABASE_URL via the Prisma env loader. Prisma does not automatically resolve a .env file for CLI calls outside a process that has already loaded environment variables.

Therefore:

- EXPECTED_ENV_SOURCE: .env file in the repository root
- EXPECTED_LOAD_METHOD: repository-proven environment loader or equivalent process-level environment injection before Prisma CLI is invoked
- CURRENT_PROCESS_HAS_DATABASE_URL: YES

## Step 3 — .env structure review

The .env file is present and contains a DATABASE_URL assignment. The key is present, the value is prefixed with the PostgreSQL scheme, and the entry uses the repository’s expected shape.

- DATABASE_URL_ENTRY_PRESENT = YES
- DATABASE_URL_FILE_FORMAT = VALID

No credential values were printed in this record.

## Step 4 — current process environment restoration

The required values were loaded into the current certification process without exposing the secrets.

Observed result:

- DATABASE_URL = LOADED
- GLW_APP_URL = LOADED
- GLW_N8N_PAGE_WEBHOOK_URL = LOADED
- GLW_N8N_BASE_URL = LOADED
- GLW_N8N_API_KEY = LOADED

## Step 5 — Prisma environment proof

Commands executed successfully after restoring the process environment:

- npx prisma --version
- npx prisma validate
- npx prisma migrate status

Observed outcomes:

- Prisma version resolved successfully: 7.9.0
- Prisma schema validation: PASS
- Database schema status: CURRENT

Result: PASS

## Step 6 — root environment issue classification

Primary classification: DOTENV_NOT_AUTOMATICALLY_LOADED

This is the smallest accurate root cause statement based on the current evidence:

- .env exists and contains the expected DATABASE_URL assignment
- Prisma CLI does not resolve it automatically in a fresh process
- the repository’s runtime/deploy path explicitly loads the file before runtime startup
- the certification CLI path failed because the environment was not loaded into the process before calling Prisma

## Step 7 — recommended future-safe bootstrap

Recommended future-safe solution for rebooted environments:

- Require a single proven bootstrap script or wrapper that loads .env into the process before any Prisma or runtime certification tool is invoked
- Use the repository’s existing PowerShell loader pattern as the canonical method
- Validate presence of DATABASE_URL and required runtime variables before running Prisma or the production runtime

This recommendation does not change tracked source or the immutable release SHA.

## Step 8 — certification retry readiness

Result: READY_TO_RETRY

Conditions satisfied:

- exact SHA unchanged
- DATABASE_URL available to Prisma
- Prisma validate PASS
- migrations CURRENT
- required environment variables present

The release candidate is ready for the next canonical immutable-SHA certification retry without changing the candidate.
