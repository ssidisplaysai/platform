# Genesis Deployment Checklist v0.1.0

## Pre-Deployment
1. Confirm target branch and commit SHA are approved.
2. Confirm working tree clean on deployment operator workspace.
3. Confirm production build artifacts can be generated (`npm run build`).
4. Confirm governance and constitutional documentation references are current.
5. Confirm rollback plan and responsible owner are declared.
6. Confirm endpoint and DNS expectations for `https://app.ssiai.app`.

## Deployment
1. Fetch and checkout approved release commit.
2. Install dependencies with deterministic lockfile (`npm ci`).
3. Build production runtime artifacts (`npm run build`).
4. Start runtime using production contract (`npm run start` or approved startup script).
5. Verify process is bound to expected runtime port and host context.

## Post-Deployment
1. Verify root route `/` loads.
2. Verify `/glw` loads without 404.
3. Verify `/glw/pages` loads without 404.
4. Verify navigation contains GLW entry.
5. Verify shell and workspace context render normally.

## Rollback
1. Identify rollback target commit.
2. Stop current production runtime gracefully.
3. Checkout rollback commit.
4. Rebuild (`npm run build`) and restart (`npm run start`).
5. Re-run post-deployment verification checks.
6. Record rollback event and impact summary in release history addendum.

## Production Verification
1. Endpoint reachable at `https://app.ssiai.app`.
2. Cloudflare edge response headers present.
3. Application shell loads and route navigation is functional.
4. No release-critical route returns 404.

## Health Verification
1. Run `node tools/genesis/genesis.mjs doctor`.
2. Run `node tools/genesis/genesis.mjs self validate`.
3. Confirm status: Doctor Healthy, Self Validation VALID.
4. Record command outputs in deployment evidence.
