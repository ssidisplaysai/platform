# 11 Identity and Authorization Integration

## Integration Model

1. Schedule creation/mutation records actor identity in schedule and audit records.
2. SchedulingEngine consumes injected authorizer boundary.
3. No local role engine is implemented.
4. No credential or session handling is implemented in scheduling.

## Service Identity

System-originated occurrence dispatch uses explicit actor identity:
- system:scheduling-engine

## Boundary Confirmation

1. Authentication capability is consumed, not reimplemented.
2. Authorization capability is consumed, not reimplemented.
