# 01 Slice Scope

Slice 6 extends Inventory with lot, serial, and expiration state capabilities.

Implemented:
- LotService with registration, metadata update, quarantine/release, retirement.
- SerialNumberService with registration, binding constraints, quarantine/release, retirement.
- ExpirationService with deterministic evaluation and state recording.
- Lot/serial/expiration read-only query surfaces.
- Runtime registration for Slice 6 services and queries.

Not implemented:
- Persistence and out-of-process integrations.
- Receiving/picking/packing workflows.
- Reorder policy and supplier/manufacturing workflows.
