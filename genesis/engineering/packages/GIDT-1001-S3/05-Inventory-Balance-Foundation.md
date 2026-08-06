# 05 Inventory Balance Foundation

Implemented behavior:

1. initialize Inventory Balance
2. require valid Inventory Item
3. require valid Warehouse
4. require valid Storage Location and Bin where provided
5. enforce tenant consistency
6. enforce unique balance identity for the active dimensional key
7. expose read-only quantity state
8. validate quantity invariants
9. compute availability deterministically
10. retrieve and list balances deterministically
11. emit audit evidence for initialization and metadata updates

Active dimensional key in Slice 3:

1. tenant
2. Inventory Item
3. Warehouse
4. Storage Location, optional
5. Bin, optional
6. status

Deferred dimensions, explicit and not represented as implemented:

1. lot
2. serial

Foundation quantity posture:

1. balances are zero-initialized by default
2. no receipt, adjustment, transfer, reservation, allocation, or movement-based mutation was implemented