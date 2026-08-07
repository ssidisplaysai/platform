# 05 Append-Only Ledger

Implemented ledger behavior:

1. append ledger entries only
2. reject duplicate ledger IDs
3. reject mutation attempts
4. reject deletion attempts
5. preserve deterministic ordering by generated ordering key
6. retrieve ledger entry
7. list ledger entries
8. list ledger by Inventory Item
9. list ledger by balance
10. list ledger by movement
11. expose append-only integrity verification
12. emit integrity rejection evidence when verification fails

Implemented ledger entry fields:

1. ledger entry ID
2. movement ID
3. tenant ID
4. Inventory Item ID
5. affected balance ID
6. quantity delta
7. resulting quantity summary
8. entry type
9. sequence and deterministic ordering key
10. correlation ID
11. timestamp
12. audit linkage

Boundary preservation:

1. no destructive historical rewrite exists
2. no update or delete API exists for ledger history