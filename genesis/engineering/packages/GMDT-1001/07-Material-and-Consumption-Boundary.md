# 07 Material and Consumption Boundary

## Authority Model

Product owns BOM definitions.

Manufacturing may derive and owns:
- work-order material requirements
- required execution quantity
- material issue requests
- consumption intent
- actual material consumption facts

Inventory owns:
- stock availability
- reservation
- allocation
- movement
- physical quantity state

## Mutation Boundary

Manufacturing records consumption intent and facts but does not directly mutate Inventory quantities.
