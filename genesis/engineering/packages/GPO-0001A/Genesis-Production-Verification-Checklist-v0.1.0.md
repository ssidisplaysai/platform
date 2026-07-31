# Genesis Production Verification Checklist v0.1.0

## Endpoint Availability
Expected result:
1. `https://app.ssiai.app` returns successful HTTP response.
2. Cloudflare edge is present in response path.

## Route Verification
Expected result:
1. `/` loads successfully.
2. `/glw` loads successfully without 404.
3. `/glw/pages` loads successfully without 404.

## Authentication and Shell Verification
Expected result:
1. Existing Genesis authentication model is used (no duplicate auth flow).
2. Application shell renders consistently across `/`, `/glw`, and `/glw/pages`.
3. Workspace context controls remain visible and functional.

## Navigation Verification
Expected result:
1. GLW entry is visible in navigation as configured.
2. GLW navigation routes to `/glw`.
3. GLW Pages access path routes to `/glw/pages`.

## Cloudflare Connectivity
Expected result:
1. Public endpoint resolves through Cloudflare DNS/edge.
2. Edge response headers remain present.

## Port and Runtime Verification
Expected result:
1. Production runtime process is active and healthy.
2. Port 3001 operational expectation is verified according to host deployment configuration.
3. No conflicting process prevents expected runtime startup.

## Windows Scheduled Task Verification
Expected result:
1. Production startup task exists and is enabled.
2. Startup action points to approved production startup script.
3. Reboot/startup behavior is confirmed by operations evidence.

## Health Validation
Expected result:
1. Genesis Doctor reports Healthy.
2. Genesis Self Validation reports VALID.
3. Verification artifacts are recorded in closeout evidence package.
