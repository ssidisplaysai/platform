# Architecture Delta

## Preserved Structure

- contracts remain type and interface only
- services remain orchestration and behavior layer
- transports remain adapter layer

## Added Layer

- persistence layer introduced beneath service orchestration
- persistence remains abstraction-first and transport-neutral

## Dependency Direction

MessageBus -> persistence interfaces/coordinator -> file persistence implementations

DeliveryPipeline -> retry/dead-letter/audit callbacks -> persistence coordinator stores

Mission Control routes -> MessageBus read-only snapshots

## Boundary Preservation

No workflow, notification, authentication, authorization, or business-domain ownership was introduced.
