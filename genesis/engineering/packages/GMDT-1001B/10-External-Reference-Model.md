# 10 External Reference Model

Bounded external references supported:
- Product
- Product Variant
- Product Version
- Product BOM
- Inventory Item
- Inventory Reservation
- Inventory Allocation
- Inventory Movement
- Organization
- Person or Contact
- Asset
- Document
- Knowledge
- Commerce Order
- Finance Classification

Reference model rules:
- stable identifiers only
- foreign canonical records are not copied as authority
- mandatory references fail closed
- optional references are explicit
- tenant safety enforced
- all references auditable
- validation occurs through approved bounded contracts
- no foreign persistence access

Reference lifecycle policy:
- reference creation requires validity check per contract
- reference deactivation follows foreign-status compatibility rules
- immutable reference history for traceability-critical records
