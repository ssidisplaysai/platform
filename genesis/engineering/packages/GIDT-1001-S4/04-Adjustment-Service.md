# 04 Adjustment Service

Implemented behavior:

1. apply approved increase adjustment
2. apply approved decrease adjustment
3. require adjustment reason
4. require idempotency key
5. require expected version
6. enforce quantity invariants
7. reject invalid negative outcomes through movement validation
8. create corresponding movement records
9. append corresponding ledger entries
10. emit accepted and rejected audit evidence
11. expose deterministic adjustment result through returned movement record

History preservation:

1. adjustments never rewrite prior ledger history
2. corrections require new compensating movements