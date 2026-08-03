# Dependency Matrix

## Allowed Dependency Flow
| Runtime | May Depend On |
|---|---|
| IBR | Replay |
| Entity | IBR, Replay |
| Relationship | Entity, IBR, Replay |
| Business Rule | Relationship, Entity, IBR, Replay |
| Business Genome Assembly Runtime | Business Rule, Relationship, Entity, IBR, Replay |

## Forbidden Dependency Patterns
- reverse dependency to downstream runtime
- cross-layer bypass that ignores required semantic staging
- redesign dependency from Phase 2 into Phase 1 runtime internals

## Control Rule
One-way flow is mandatory and certification-enforced.