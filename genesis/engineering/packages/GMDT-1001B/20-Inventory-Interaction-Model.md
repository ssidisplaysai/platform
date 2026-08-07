# 20 Inventory Interaction Model

Manufacturing owns execution intent and facts.

Inventory owns stock mutation and stock authority.

## Conceptual Contract Flows

1. Material availability inquiry
   - Manufacturing requests availability by item and context
   - Inventory returns authoritative stock availability state

2. Material reservation request
   - Manufacturing submits reservation intent
   - Inventory creates or rejects reservation by policy

3. Material allocation request
   - Manufacturing requests allocation against reservation or demand
   - Inventory returns allocation outcomes

4. Material issue or movement request
   - Manufacturing requests issue movement intent
   - Inventory records movement and ledger authority

5. Material consumption confirmation
   - Manufacturing records consumption fact with movement correlation
   - Inventory remains stock authority

6. Return-to-stock request
   - Manufacturing issues return intent
   - Inventory executes return mutation and movement authority

7. Finished-goods receipt request
   - Manufacturing reports production output and receipt intent
   - Inventory executes finished-goods stock mutation

8. Scrap or write-off request where approved
   - Manufacturing reports scrap fact and stock-impact request
   - Inventory applies approved stock mutation path

9. Lot or Serial trace linkage
   - Manufacturing stores lot or serial references for traceability
   - Inventory remains canonical lot and serial authority

## Correlation and Idempotency Across Platforms

- every cross-platform request carries correlationIdentifier and idempotencyKey
- duplicate request with same payload is replay-safe
- same key with conflicting payload is rejected deterministically

## Inventory Condition Interaction

GIDT-CERT-C001 interaction model for future evidence expansion:
- valid Work Order reference validation path
- invalid Work Order reference validation path
- tenant mismatch rejection path
- inactive or closed Work Order handling path where relevant
- unavailable Manufacturing validator degradation path

This package documents the model only and does not remediate Inventory.
