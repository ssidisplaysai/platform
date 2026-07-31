# Deployment Record

## Deployment Identity
- Release Identifier: GPR-0002
- Version: v0.1.0
- Deployment Date: 2026-07-30
- Release Commit: 7214c6adccc6078efe1aa1758b2908a9cf11d597

## Production Deployment Context
- Production Directory: C:\Users\rober\Documents\Stoner Platform\platform-production
- Deployment Method: governed pull/update in dedicated production worktree
- Deterministic Install Command: npm ci (PASS)
- Production Build Command: npm run build (PASS)
- Startup Contract: Windows Scheduled Task executes C:\Users\rober\Documents\Stoner Platform\start-genesis.ps1
- Runtime Port: 3001
- Public Domain: https://app.ssiai.app

## Operational Switch
The production runtime ownership was switched from prior non-canonical runtime control to scheduled-task ownership using the clean dedicated production worktree as the authoritative runtime source.
