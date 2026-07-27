# Genesis Business Agent Dependency Model

## Purpose
Define allowed and prohibited agent dependency directions to prevent circular ownership, runtime cycles, and cross-agent mutation.

## Dependency Types
1. Capability dependency: one agent consumes intelligence from another.
2. Reporting dependency: one agent contributes to Executive synthesis.
3. Domain dependency: all agents consume canonical enterprise entities.
4. Runtime dependency: orchestration call paths among agent runtime services.

## Allowed Dependency Directions
1. Marketing -> Sales
2. Sales -> Finance
3. Finance -> Executive
4. Customer Success -> Executive
5. Operations -> Manufacturing
6. Manufacturing -> Finance
7. Operations -> Finance
8. Sales -> Operations
9. Marketing -> Executive
10. Operations -> Executive
11. Manufacturing -> Executive
12. Sales -> Executive
13. Customer Success -> Sales
14. Customer Success -> Finance
15. Customer Success -> Operations
16. All agents -> Enterprise Domain (read canonical entity context)

## Dependency Constraints
1. Direction denotes read/signal consumption, not write authority.
2. Downstream dependency does not transfer ownership.
3. Executive is an aggregation endpoint, not a mutation endpoint for peer agents.

## Prohibited Dependency Patterns
1. Circular capability ownership dependency (A owns capability requiring B mutation, while B owns capability requiring A mutation).
2. Mutual cross-agent write dependencies.
3. Agent-to-agent direct repository mutation.
4. Dependency on undeclared private internals of another agent.
5. Runtime cycle that creates unbounded recursive aggregation.

## Circular Prevention Rules
1. Agent dependency graph must be acyclic for write paths.
2. Read-only consumption graph may be broad but must avoid recursive execution loops.
3. Any proposed new dependency must include cycle analysis before approval.
4. Shared abstractions should be promoted to Enterprise Domain or shared runtime layer when reused by multiple agents.

## Recommended Validation Controls
1. Architecture review check for every new dependency declaration.
2. Static dependency scan for circular import/call paths in agent runtime layers.
3. Policy review ensuring action namespaces do not imply cross-agent mutation rights.
4. Regression check that consumer agents tolerate producer unavailability without ownership breach.

## Constitutional Dependency Graph (Conceptual)
1. Marketing -> Sales -> Finance -> Executive
2. Operations -> Manufacturing -> Finance -> Executive
3. Customer Success -> Executive
4. Customer Success -> Sales
5. Customer Success -> Finance
6. All agents -> Enterprise Domain

## Extensibility Rule
Any new dependency introduced by future agents must explicitly state:
1. Why read-only consumption is needed.
2. Why ownership remains unchanged.
3. Why no cycle is introduced.
4. Which invariants remain satisfied.
