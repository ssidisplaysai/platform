# Genesis Production Operations Runbook

## Purpose
Provide the official operational manual for running Genesis as a continuously available production platform.

## Production Architecture
1. Runtime application: Next.js production server (`next start`).
2. Public access path: Cloudflare edge endpoint at `https://app.ssiai.app`.
3. Host operating model: Windows host with startup automation and managed process lifecycle.
4. Governance baseline: Genesis constitutional controls with doctor/self-validation verification.

## Startup Procedure
1. Open operations shell with required host permissions.
2. Navigate to repository root.
3. Ensure production build artifacts are current (`npm run build`).
4. Start production runtime (`npm run start`) or execute the approved production startup script.
5. Verify endpoint responds at `https://app.ssiai.app`.
6. Verify runtime health with Genesis validation commands.

## Shutdown Procedure
1. Announce maintenance window if required by governance policy.
2. Stop the production process gracefully.
3. Confirm port release and process termination.
4. Re-run local health checks to ensure no orphan runtime remains.

## Recovery Procedure
1. Confirm host process state and failed process logs.
2. Resolve immediate runtime blockers (dependency, build, port, or host state).
3. Rebuild production artifacts if required.
4. Restart using approved production startup path.
5. Re-verify endpoint and validation checks.
6. Record incident summary in operations log and release history references.

## Port Conflict Handling
1. Identify active listeners on production port.
2. Determine whether listener is authorized Genesis runtime.
3. Stop unauthorized or stale process.
4. Restart production runtime.
5. Verify correct process ownership and endpoint response.

## Cloudflare Path Verification
1. Confirm public DNS resolution for `app.ssiai.app`.
2. Confirm Cloudflare-served response headers.
3. Confirm endpoint returns expected Next.js response behavior.
4. Escalate if Cloudflare tunnel or edge route is degraded.

## Windows Task Scheduler Operations
1. Verify startup task exists and is enabled.
2. Confirm trigger conditions for host boot/login start.
3. Confirm task action targets approved production startup script.
4. Validate restart behavior after host reboot.
5. Record task changes through governance controls.

## Production Build Procedure
1. Install dependencies (`npm ci`).
2. Compile production artifacts (`npm run build`).
3. Validate build completion without fatal errors.
4. Start runtime (`npm run start`).
5. Run post-start checks.

## Local Development Procedure
1. Use `npm run dev` only for development or feature validation.
2. Do not classify `next dev` runtime as production evidence.
3. Keep development and production startup paths explicit and separated.

## Deployment Process (Governed)
1. Complete branch-level engineering and governance checks.
2. Build and validate release candidate artifacts.
3. Merge authorized changes via governed workflow.
4. Execute production startup and verification steps.
5. Record release in constitutional release history institution.

## Verification Procedures
Run the following verification set:
1. TypeScript validation (`npx tsc --noEmit`) where scoped baseline allows.
2. Lint and targeted tests for changed scope.
3. Genesis Doctor (`node tools/genesis/genesis.mjs doctor`).
4. Genesis Self Validation (`node tools/genesis/genesis.mjs self validate`).
5. Public endpoint check (`https://app.ssiai.app`).

## Operational Evidence Requirements
1. Startup evidence (time, host, command path).
2. Endpoint verification evidence.
3. Validation outputs (doctor/self-validation and relevant tests).
4. Incident/recovery records where applicable.
5. Release history cross-reference for production-impacting changes.
