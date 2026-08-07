# 01 Domain Overview

Manufacturing owns production execution authority. Product remains design authority. Inventory remains stock authority. Shared remains infrastructure authority.

Manufacturing domain purpose:
- model executable production intent and outcomes
- represent deterministic work-order execution lifecycle
- record material demand, consumption facts, and production output facts
- preserve immutable traceability across work, material, operation, output, and exception flows
- maintain concurrency-safe and idempotent command semantics

Manufacturing model principles:
- one canonical owner per concept
- explicit aggregate boundaries
- deterministic identifiers and lifecycle transitions
- foreign records are references only
- no direct mutation of Inventory stock state
- no takeover of Product design authority
- no takeover of Commerce or Finance authority

Primary domain areas:
- Work management: work order, production order, run, batch, jobs
- Execution routing and operations: sequence, dependencies, checkpoints
- Material execution: requirement, issue request, consumption, variance
- Output execution: completion, reject, scrap, rework, yield
- Operational resources: work center, production cell, machine/tool/labor assignment
- Runtime execution state: WIP, status, downtime, exceptions
- Traceability and external references: immutable lineage and foreign reference safety
