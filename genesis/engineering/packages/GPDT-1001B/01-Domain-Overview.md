# 01 Domain Overview

Domain purpose:

- The Product Platform is the canonical authority for Product-domain definition.
- The domain model defines what Product engineering must implement and what it must not own.

Canonical owner:

- Product Platform owns Product-definition concepts only, as established in GPDT-1001A.

Domain intent:

1. Maintain one canonical Product truth for product definition.
2. Provide stable definitions consumed by Inventory, Manufacturing, Commerce, CRM, Finance, Analytics, and other authorized consumers.
3. Preserve external ownership for execution and custody domains.

Domain boundaries:

1. Product owns definitions, relationships, lifecycle, and reference composition.
2. Product does not own downstream execution state.
3. Product references external canonical records through stable identifiers.

Modeling principles:

1. Identity first.
2. Contract-first boundary behavior.
3. Reference-only integration for foreign domains.
4. Deterministic lifecycle and version semantics.
5. Invariant-driven consistency boundaries.
