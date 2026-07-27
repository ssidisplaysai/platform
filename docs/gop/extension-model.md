# Extension Model

Status: Frozen by GOP-0004A

## 1. Extension Philosophy

Modules extend Genesis by conforming to platform contracts, not by bypassing runtime services.

All extensions must integrate through:

- module manifests
- execution creation and synchronization
- event emission and replay compatibility
- authorization and workspace boundaries

## 2. Extension Surfaces

Frozen extension surfaces:

- module registry and manifest contracts
- inspector extension registration model
- runtime APIs for operations and execution context
- queue and worker contract usage

## 3. Domain Module Examples

Expected extension domains:

- Business Genome
- Media
- Plugins
- AI Agents
- Products
- Blogs
- Knowledge
- external integrations

Each domain must map domain operations to execution lifecycle and event streams.

## 4. Inspector Extension Constraints

Inspector extensions may:

- render domain sections
- require permission checks
- filter by job type and status
- observe execution context

Inspector extensions may not:

- mutate runtime state directly from render path
- bypass authorization filters

## 5. Event and Execution Compatibility

Extensions must preserve:

- event ordering semantics
- idempotency behavior
- terminal event integrity
- execution status transition constraints

## 6. Queue and Worker Compatibility

Extensions may define new workerType values and capabilities, but must use existing queue and worker contracts.

No extension may redefine queue state semantics.

## 7. External Integration Pattern

External systems integrate through adapter boundaries that:

- normalize external signals into runtime-compatible events or execution updates
- preserve correlation and causation metadata when available
- fail safely without breaking core runtime invariants

## 8. Constitutional Extension Rules

Future module implementations must not:

- bypass execution engine for orchestrated work
- bypass event store for timeline history
- bypass authorization for module discovery and actions

Contract expansion is allowed only via additive, versioned evolution.
