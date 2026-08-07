# 01 Runtime Overview

The Manufacturing runtime is an execution engine for production work, not a general enterprise workflow framework.

Runtime responsibilities:
- execute work orders and routing steps deterministically
- derive and maintain material requirements from approved Product BOM references
- coordinate bounded Inventory interactions without mutating stock directly
- record production output, yield, scrap, rework, WIP, downtime, and traceability facts
- expose read-only projections for Mission Control and operational consumers

Runtime principles:
- Manufacturing is execution authority only
- Product remains design authority
- Inventory remains stock authority
- Shared remains infrastructure authority
- foreign records are referenced, not owned
- commands mutate only within aggregate boundaries
- projections are recomputable from canonical facts

Implementation-ready shape:
- contracts for bounded platform integration
- domain for entities, aggregates, invariants, and events
- commands and queries as application surfaces
- services as authority-bearing orchestration units
- persistence as tenant-partitioned execution state plus append-only history
- runtime as composition, startup, recovery, and observation wiring
