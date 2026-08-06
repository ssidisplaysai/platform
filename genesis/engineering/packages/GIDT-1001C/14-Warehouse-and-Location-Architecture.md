# 14 Warehouse And Location Architecture

Warehouse registration:

1. CreateWarehouse requires unique warehouse code per tenant.
2. Warehouse state lifecycle includes active, inactive, archived.

StorageLocation and Bin registration:

1. CreateStorageLocation requires existing warehouse parent.
2. CreateBin requires existing storage location parent.
3. Code uniqueness rules: location unique per warehouse, bin unique per location.

Containment validation:

1. Parent must exist and be tenant-aligned.
2. Recursive containment is prohibited.
3. Invalid parent states reject child creation.

Operational behavior by state:

1. Inactive warehouse or location blocks normal receiving/picking/transfer.
2. Quarantine-designated locations accept only quarantine movement classes.
3. Receiving-designated locations accept receive and put-away source transitions.
4. Picking-designated locations enforce allocation-required pick operations.
5. Staging locations support transfer and ship-preparation paths by policy.

Virtual location limitations:

1. Virtual locations allowed only for explicitly modeled in-transit or reconciliation scopes.
2. Virtual locations cannot bypass physical stock invariants.

Location-capacity metadata:

1. Capacity metadata may be advisory or hard-enforced by policy.
2. Hard-capacity violations reject commands.

Cross-warehouse transfer behavior:

1. TransferInventory creates transfer movement facts for source and destination scopes.
2. Source decrement and destination increment commit atomically under coordinated persistence.

Recovery-time containment validation:

1. Validate all locations map to existing warehouses.
2. Validate all bins map to existing locations.
3. Validate no recursive containment links.
4. Unrecoverable containment corruption blocks startup.