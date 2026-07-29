# Genesis Commerce Platform Service Inventory

## Service Inventory Baseline (2026-07-29)

| Service | Owner | Startup Method | Endpoint or Port | Health Check Performed | Result | Notes |
|---|---|---|---|---|---|---|
| Next.js application shell | Commerce Platform | npm run dev | http://localhost:3000 | HTTP GET to root and browser route smoke tests | HEALTHY | Started successfully and served multiple routes |
| Dashboard route surface | Commerce Platform | Included in Next.js startup | /, /companies, /companies/ssi, /companies/led-display-warehouse | Browser navigation + console/pageerror probe | HEALTHY | No blocking console or runtime page errors detected during smoke run |
| PostgreSQL listener | Shared service dependency | External already running process | localhost:5432 | Test-NetConnection localhost:5432 | REACHABLE | Query-level verification unavailable due missing local client wiring in this package scope |
| n8n service | Workflow infrastructure dependency | Not recovered locally in this workspace | localhost:5678 | Test-NetConnection localhost:5678 | UNHEALTHY | Port closed; no active local n8n process found |
| WordPress publishing path | External integration dependency | PAT workflow runner | PAT-0001 runtime path | PAT script execution and report review | BLOCKED | Missing OPENAI_API_KEY, LED_WP_BASE_URL, LED_WP_USERNAME, LED_WP_APPLICATION_PASSWORD |
| Docker runtime | Local dependency host (optional in this workspace) | docker command expected if used | N/A | Get-Command docker | UNAVAILABLE | Docker CLI not installed or not on PATH |

## Ports Inspected
- 3000: Next.js expected local app port
- 3001: alternate app port (not in use)
- 5432: PostgreSQL listener detected and reachable
- 5678: n8n expected port, not reachable
- 6379: Redis expected in some deployments, not detected in this local baseline
- 8080: generic service port, not detected in this local baseline

## Authentication and Database Topology Notes
- No dedicated end-user auth provider package was detected in src/app code paths.
- Application routes observed in this recovery run render without auth gate enforcement in current snapshot.
- No root prisma schema path was detected at prisma/schema.prisma.

## Service Recovery Summary
- Restored and validated app shell and dashboard routes.
- Verified database port reachability.
- Confirmed n8n and WordPress publication remain blocked by external environment prerequisites.
