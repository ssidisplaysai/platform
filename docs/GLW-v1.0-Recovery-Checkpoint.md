# GLW v1.0 Recovery Checkpoint

Generated: 2026-08-10
Scope: Recovery assets required for frozen production baseline

## Asset Confirmation

- Repository freeze commit: `7b5ffce424e0879b802bfc02814ebcdeb6c7e8d8`
- Freeze tag: `glw-production-v1.0`
- n8n production workflow export: `backups/n8n/glw-page-engine-v1.0.json`
- Freeze document: `docs/GLW-Publishing-Engine-v1.0-Freeze.md`
- Test cleanup report: `docs/GLW-v1.0-Test-Page-Cleanup-Candidates.md`
- Security rotation checklist: `docs/GLW-v1.0-Security-Rotation-Checklist.md`

## Recovery Methods (No Secrets)

WordPress backup method:
- Use hosting provider backup snapshot tooling for full WordPress filesystem backup prior to any v1.1+ changes.

Database backup method:
- Use managed PostgreSQL backup/snapshot tooling or logical dump procedure maintained by operations.

Uploads backup method:
- Archive WordPress uploads directory from hosting filesystem backup workflow.

Cloudflare routing documentation:
- Reference routing and ingress context in `Genesis-GLW-Baseline-0001.md`.

Startup/runtime documentation:
- Runtime and freeze behavior references:
  - `docs/GLW-Publishing-Engine-v1.0-Freeze.md`
  - `docs/glw-page-generation-setup.md`

## Freeze Rule

GLW v1.0 production baseline is frozen.
All future work must proceed as:
Development -> validation -> smoke test -> versioned promotion -> production.
