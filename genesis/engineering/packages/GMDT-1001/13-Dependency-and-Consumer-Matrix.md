# 13 Dependency and Consumer Matrix

## Authoritative Dependency Direction

| Direction | Meaning |
|---|---|
| Product -> Manufacturing | Manufacturing consumes Product definitions and references Product design authority. |
| Shared -> Manufacturing | Manufacturing consumes Shared runtime infrastructure and utilities. |
| Inventory <-> Manufacturing (bounded contracts) | Manufacturing requests stock-affecting actions; Inventory returns stock authority outcomes. |

## Manufacturing Fact Emission Consumers

Manufacturing may emit facts for:
- Commerce
- Finance
- Analytics
- Mission Control

## Circular Ownership Prevention

No circular ownership is introduced. Cross-platform interactions are contract-bounded while canonical authority remains singular per domain concept.
