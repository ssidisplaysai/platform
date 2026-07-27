# GEA-0002 Replay

## Replay Model
Replay records are stored as ToolReplayRecord and persisted in GeaToolReplay.

## Captured Replay Context
1. tool version id
2. input contract version
3. agent version
4. permission evaluation context
5. runtime version
6. deterministic support flag
7. deterministic match result when applicable
8. replay checksum

## Deterministic vs Non-Deterministic Behavior
1. Deterministic tools record deterministicMatch=true when replay context matches.
2. Non-deterministic tools set deterministicSupported=false while still storing full invocation context and result lineage.

## API
1. POST /api/gea/tools/replay creates replay records.
2. GET /api/gea/tools/executions/[id] returns execution plus replay history.
