# 16 Warehouse And Location Model

Topology:

1. Warehouse contains StorageLocations.
2. StorageLocation optionally contains Bins.
3. Quantity scopes may be warehouse-level, location-level, or bin-level.

State constraints:

1. Inactive warehouse blocks new inbound/outbound movement unless override policy applies.
2. Inactive location/bin blocks assignment and movement into scope.
3. Archived location/bin cannot receive new stock.

Capacity semantics:

1. Capacity metadata is advisory unless policy marks as hard constraint.
2. Hard-capacity violation attempts fail closed.

Transfer semantics:

1. Intra-warehouse transfer: location/bin reassignment without warehouse change.
2. Inter-warehouse transfer: explicit Transfer lifecycle with source and destination facts.
3. Transfer completion requires balanced out/in movement facts.

Addressing and codes:

1. WarehouseCode unique per tenant.
2. LocationCode unique within warehouse scope.
3. BinCode unique within location scope.

Audit trace rules:

1. Every placement move records source and destination scope.
2. Null source allowed only for initial receive-type semantics.
3. Null destination allowed only for ship/consume/dispose semantics.