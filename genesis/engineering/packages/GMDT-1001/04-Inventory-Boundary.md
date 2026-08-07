# 04 Inventory Boundary

## Inventory Is Canonical Stock Authority

Inventory remains canonical owner for:
- on-hand quantity
- available quantity
- reserved quantity
- allocated quantity
- Warehouse
- Storage Location
- Bin
- Lot
- Serial
- Inventory Movement
- Inventory Ledger
- Inventory Reservation
- Inventory Allocation

## Manufacturing Ownership in This Boundary

Manufacturing owns:
- material demand and requirement
- material request and consumption intent
- production output intent
- work-order execution state

## Contract Rule

Manufacturing must request stock changes through Inventory contracts and must never directly mutate Inventory quantities or inventory ledgers.

## Inventory Condition Interaction

Inventory certification conditions GIDT-CERT-C001 and GIDT-CERT-C002 remain low and non-blocking. Manufacturing integration is expected to expand external-validator evidence in future integration work, without changing Inventory authority in this ownership package.
