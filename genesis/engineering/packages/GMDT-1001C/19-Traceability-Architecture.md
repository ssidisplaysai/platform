# 19 Traceability Architecture

Trace links span:
- Product Version
- BOM Version
- Work Order
- Production Run
- Batch
- Operation
- Material Requirement
- Inventory Reservation
- Inventory Allocation
- Inventory Movement
- Lot
- Serial
- Consumption
- Output
- Scrap
- Rework
- Machine
- Labor
- Document
- Knowledge
- Quality Hold

Trace record design:
- trace record identity is immutable
- correlation IDs connect command chains and execution lines
- append-only behavior is mandatory
- correction behavior uses compensating records, not rewrite
- recovery validates trace continuity and rejects corrupted history
