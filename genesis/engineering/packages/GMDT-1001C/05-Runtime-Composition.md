# 05 Runtime Composition

Runtime composition is the top-level wiring for Manufacturing and uses certified Shared infrastructure only.

Composition layers:
- bootstrap and runtime options
- shared runtime host and lifecycle manager
- service registry and provider registry
- Manufacturing command services
- Manufacturing query services and projection builders
- Product and Inventory integration adapters
- persistence and recovery coordinators
- health, metrics, audit, and traceability publishers

Composition rules:
- runtime composition is declarative and deterministic
- module order respects dependency direction: contracts -> domain -> services -> commands/queries -> persistence/projections -> runtime
- integration adapters are registered before command admission
- failure to initialize mandatory validators blocks readiness
- no business logic is placed inside runtime composition code paths

Runtime entry points:
- start: initialize, validate, load, rebuild, register observations, mark ready
- stop: drain in-flight commands, flush audit/trace, persist final state, mark stopped
- recover: load snapshot, replay append-only history, validate invariants, rebuild projections, then admit commands
