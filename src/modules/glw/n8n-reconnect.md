# GLW n8n reconnect callback gate

This module provides the staging-safe callback reconciliation gate for GLW page-generation executions.

## Environment flags

- `GLW_N8N_RECONNECT_ENABLED`  
  Defaults to disabled when unset. Callback reconciliation returns `FEATURE_DISABLED` unless explicitly set to `true`.

- `GLW_N8N_CALLBACK_SECRET`  
  Required bearer secret for callback authentication (`Authorization: Bearer <secret>`), validated with constant-time comparison.

- `GLW_N8N_NON_MUTATING_TEST`  
  When `true`, MCP dispatch uses a synthetic accepted execution and does not invoke `execute_workflow`.

## Callback contract behavior

- Accepts `jobId` (or legacy `id`), `executionId`, and status.
- Normalizes in-flight statuses (`RUNNING`, `GENERATING_CONTENT`, `GENERATING_IMAGE`, `UPLOADING_IMAGE`, `PUBLISHING`) to runtime `RUNNING`.
- Supports terminal `FAILED` and `CONTENT_READY` transitions.
- Rejects callback `COMPLETE` transitions (`UNAUTHORIZED_COMPLETE`) so WordPress completion authority remains inside Genesis.
- Rejects callback attempts to provide WordPress destination identifiers (`WORDPRESS_AUTHORITY_REJECTED`).
- Enforces exact job identity, execution binding, organization/site isolation, transition validity, and idempotent replay handling.

## Synthetic staging callback seed utility

To support bounded callback reconciliation tests without invoking generation or WordPress preflight, use:

- `npx tsx scripts/glw-seed-synthetic-callback-job.mts --owner-approval-id OWNER_APPROVAL-... --execution-id synthetic-execution-... --confirm SEED-SYNTHETIC-CALLBACK-JOB`
- Runtime-packaged command inside the staging container image:
  `node runtime-tools/glw-seed-synthetic-callback-job-runtime.cjs --owner-approval-id OWNER_APPROVAL-... --execution-id synthetic-execution-... --confirm SEED-SYNTHETIC-CALLBACK-JOB`

Guardrails:

- Refuses to run unless `GENESIS_ENVIRONMENT=staging`.
- Requires an explicit owner approval identifier (`OWNER_APPROVAL-...`).
- Creates exactly one non-customer synthetic job per owner approval id.
- Uses existing GLW execution repository persistence only; does not call WordPress, n8n, campaign schedulers, or paid providers.
- Persists retention metadata in `qaChecks.syntheticCallbackSeed` for owner-directed cleanup of only the seeded job.

## Isolated ECS one-shot execution shape (staging)

Use a separate `run-task` invocation with the existing staging image/task definition and override only the command for `GenesisWebRuntime`:

```json
{
  "containerOverrides": [
    {
      "name": "GenesisWebRuntime",
      "command": [
        "node",
        "runtime-tools/glw-seed-synthetic-callback-job-runtime.cjs",
        "--owner-approval-id",
        "OWNER_APPROVAL-GLW-PHASE4D-TEST-001",
        "--execution-id",
        "synthetic-execution-001",
        "--confirm",
        "SEED-SYNTHETIC-CALLBACK-JOB"
      ],
      "environment": [
        { "name": "GLW_N8N_RECONNECT_ENABLED", "value": "false" },
        { "name": "GLW_N8N_NON_MUTATING_TEST", "value": "true" }
      ]
    }
  ]
}
```

This preserves the web service startup command for normal service tasks and limits the seed action to the short-lived one-shot task only.
