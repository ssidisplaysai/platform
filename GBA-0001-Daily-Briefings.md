# GBA-0001 Daily Briefings

## Purpose
Provide executive daily briefing synthesis from governed operational state.

## Briefing Composition
- Executive summary
- Critical alerts
- Top opportunities
- Top risks
- Completed and behind-schedule goals
- Functional highlights (operations, finance, marketing, manufacturing, sales, support)
- Recommended executive actions

## Context Integration
- Attempts to build a context package through GEA memory/context framework.
- If memory/context tables are unavailable, runtime degrades safely and still generates briefing.

## Determinism and Lineage
- Briefing replay checksum derives from canonical payload fields.
- Immutable lineage captures checksum input and context linkage.

## API
- `POST /api/gba/executive/briefings/generate`
- `GET /api/gba/executive/briefings`

## Authorization
- View: `gba:executive:view_briefings`
- Generate: `gba:executive:generate_briefings`
