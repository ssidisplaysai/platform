# Genesis Commerce Platform Service Inventory

## Service Inventory Baseline (2026-07-29, R1)

| Service | Owner | Startup Method | Endpoint or Port | Health Check Performed | Result | Notes |
|---|---|---|---|---|---|---|
| Next.js application shell | Commerce Platform | npm run dev | http://localhost:3000 | HTTP GET to root and browser route smoke tests | HEALTHY | Started successfully and served multiple routes |
| Dashboard route surface | Commerce Platform | Included in Next.js startup | /, /companies, /companies/ssi, /companies/led-display-warehouse | Browser navigation + console/pageerror probe | HEALTHY | No blocking console or runtime page errors detected during smoke run |
| PostgreSQL listener | Shared service dependency | External already running process | localhost:5432 | Test-NetConnection localhost:5432 | REACHABLE | Query-level verification unavailable due missing local client wiring in this package scope |
| n8n service | Workflow infrastructure dependency | No repository-defined local startup method found | localhost:5678 | Test-NetConnection localhost:5678 | UNHEALTHY | Port closed; n8n CLI missing; no checked-in workflow export |
| WordPress publishing path | External integration dependency | PAT workflow runner | PAT-0001 runtime path | PAT script execution and report review | BLOCKED | Missing OPENAI_API_KEY, LED_WP_BASE_URL, LED_WP_USERNAME, LED_WP_APPLICATION_PASSWORD |
| Docker runtime | Potential host dependency for n8n if chosen externally | docker command expected if used | N/A | Get-Command docker and standard installation path checks | UNAVAILABLE | Docker and Docker Desktop not detected in default local paths |

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

## n8n Topology Notes
- Checked-in artifacts define n8n adapter contract, not deployment runtime.
- No n8n workflow JSON export was found in the repository.
- No docker-compose file or package script for n8n startup was found.
- n8n endpoint and workflow definition are external prerequisites.

## Service Recovery Summary
- Restored and validated app shell and dashboard routes.
- Verified database port reachability.
- Confirmed n8n and WordPress publication remain blocked by external environment prerequisites.
