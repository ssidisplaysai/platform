# 10 Audit Evidence

Audit evidence emitted includes:

1. action classification
2. tenant
3. entity type
4. entity ID
5. command metadata including command ID, correlation ID, causation ID, idempotency key, and expected version
6. resulting version and prior version where applicable
7. success or rejection classification
8. timestamp from the registered clock provider

Action classifications implemented include:

1. REGISTER_INVENTORY_ITEM
2. TRANSITION_INVENTORY_ITEM_LIFECYCLE
3. UPDATE_INVENTORY_ITEM_METADATA
4. REGISTER_WAREHOUSE
5. TRANSITION_WAREHOUSE_LIFECYCLE
6. UPDATE_WAREHOUSE_METADATA
7. REGISTER_STORAGE_LOCATION
8. TRANSITION_STORAGE_LOCATION_LIFECYCLE
9. UPDATE_STORAGE_LOCATION_METADATA
10. REPARENT_STORAGE_LOCATION
11. REGISTER_BIN
12. TRANSITION_BIN_LIFECYCLE
13. UPDATE_BIN_METADATA
14. INITIALIZE_INVENTORY_BALANCE
15. UPDATE_INVENTORY_BALANCE_METADATA

Audit ownership boundary:

1. audit sink does not own Inventory state
2. audit evidence is emitted from Inventory services only