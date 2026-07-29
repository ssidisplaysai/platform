# Genesis Commerce Platform Startup Guide

## Purpose
Restore the local development baseline after a machine restart using the repository standard startup path.

## Preconditions
1. Node.js and npm installed (validated in this run with Node v24.18.0 and npm 11.16.0)
2. Repository checked out at desired branch
3. PostgreSQL service available on localhost:5432
4. Optional but required for full publishing validation:
- n8n available on localhost:5678
- Docker available if your local dependency model expects containers
- required OpenAI and WordPress secrets exported in terminal session

## Startup Commands (Exact Order)
Run from repository root:

```powershell
Set-Location 'C:\Users\rober\Documents\Stoner Platform\platform-genesis-seo'
npm install
npm run dev
```

## Immediate Health Checks
In a second terminal:

```powershell
Set-Location 'C:\Users\rober\Documents\Stoner Platform\platform-genesis-seo'
Invoke-WebRequest -UseBasicParsing 'http://localhost:3000' | Select-Object StatusCode
Test-NetConnection -ComputerName localhost -Port 5432 | Select-Object ComputerName,RemotePort,TcpTestSucceeded
Test-NetConnection -ComputerName localhost -Port 5678 | Select-Object ComputerName,RemotePort,TcpTestSucceeded
```

Expected:
- StatusCode 200 for localhost:3000
- TcpTestSucceeded True for 5432
- TcpTestSucceeded True for 5678 only when n8n is running

## Validation Commands

```powershell
Set-Location 'C:\Users\rober\Documents\Stoner Platform\platform-genesis-seo'
npm ls --depth=0
npx tsc --noEmit
npm run lint
npm test -- --runInBand
npm run build
npx tsx marketing-engine/runtime/pat/PAT-0001-leddisplaywarehouse.mts
```

## Secret Requirements For PAT/WordPress Flow
Do not hardcode secrets in files. Set environment variables in terminal before PAT execution:
- OPENAI_API_KEY
- LED_WP_BASE_URL
- LED_WP_USERNAME
- LED_WP_APPLICATION_PASSWORD

## Known Conditions In This Baseline
- n8n was not reachable in this environment during this package execution.
- Docker command was unavailable in this environment.
- Full repository lint/typecheck/test/build include pre-existing failures not introduced by this package.
