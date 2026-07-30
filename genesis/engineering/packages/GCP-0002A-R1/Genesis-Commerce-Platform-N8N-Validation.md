# Genesis Commerce Platform n8n Validation

## Deployment Method Determination
## Evidence Reviewed
- marketing-engine/runtime/N8N_INTEGRATION.md
- marketing-engine/adapters/n8n/*
- marketing-engine/LED_PRODUCTION_MIGRATION_PLAN.md
- repository scripts and compose files (none found for n8n startup)

## Determination
- Intended role of n8n: orchestration wrapper around Marketing Runtime adapters.
- Intended deployment method in this repository snapshot: external endpoint managed outside this repository.
- Checked-in local startup method: not found.
- Docker/Compose deployment artifact: not found.
- Local n8n CLI availability: not installed (n8n command unavailable, npx --no-install n8n unavailable).

## Local Runtime Connectivity
- Endpoint probe: localhost:5678
- Result: unreachable
- Interpretation: required n8n runtime is an external dependency blocker in current environment.

## Workflow Identification Attempt
- Workflow name: not discoverable from repository (no checked-in workflow export)
- Workflow ID: not discoverable from repository
- Activation state: unknown (service unavailable)
- Editor reachability: unavailable (service unavailable)
- Recent execution history: unavailable (service unavailable)

## Webhook and Contract Model (From Adapter Boundary)
- Expected method: adapter-agnostic (not hard-coded in repository)
- Expected route/path: not hard-coded in repository
- Request schema shape:
  - payload.envelope: DispatchEnvelope contract
  - payload.job: MarketingJob contract
- Response schema shape:
  - executionId
  - status
  - stage
  - completedWorkers
  - failedWorkers
  - metricsCount
  - eventCount

## Credential and Callback Model
- n8n credentials: not discoverable in repository (no workflow export)
- Callback behavior: n8n receives runtime execution summary via adapter response and updates orchestration state externally
- Error path: adapter throws RuntimeValidationError on missing payload object, missing envelope, or missing job
- Idempotency model: enforced in runtime/workflow operation keys and publishing runtime deduplication checks, not by n8n node logic

## Minimal Correction Policy Outcome
- No n8n workflow edits performed.
- No startup method was invented.
- Blocking condition documented with exact missing dependency evidence.

## External Blocker
- Missing component: reachable n8n runtime and workflow definition for LED display publication path.
- Required owner action: provide endpoint plus workflow export or documented provisioning method.
