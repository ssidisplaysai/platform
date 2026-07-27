# GEA-0001 Capability Model

## Capability Definition
A capability carries:
1. capabilityId
2. capabilityKey
3. capabilityVersion
4. description
5. toolKeys
6. enabled flag

Implemented in src/lib/gea/capability-registry.ts.

## Seeded Enterprise Capability Set
1. marketing
2. publishing
3. analytics
4. business_genome
5. crm
6. erp
7. inventory
8. finance
9. workflow
10. email
11. calendar
12. documents
13. knowledge
14. search
15. reporting

## Resolution Rules
1. Planner resolves capabilities by key via registry.
2. Only enabled capabilities are returned.
3. Ordered deterministic processing uses lexical sort on capabilityKey.

## Governance Notes
1. Capabilities are explicit constitutional boundaries for what an agent may do.
2. Tool invocations must map to approved capabilities to execute.
