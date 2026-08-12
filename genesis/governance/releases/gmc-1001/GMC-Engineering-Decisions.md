# GMC Engineering Decisions

Work Order: GMC-1001
Date: 2026-07-30

## Decision GMC-D1: Thin consumer architecture

Mission Control is implemented as a thin orchestration layer consuming certified Registry and Health services.

## Decision GMC-D2: Dynamic assembly only

Workspace, navigation, cards, and dashboard are assembled dynamically from service data; no application-specific configuration is hardcoded.

## Decision GMC-D3: Launch metadata policy

Launch actions are resolved from registry metadata to enforce a single authoritative source for launch routing.

## Decision GMC-D4: Search and filters as orchestration concerns

Search and filtering are implemented over discovered catalog views without introducing ownership of registry or health source data.
