# 14 External Reference Rules

Manufacturing may store bounded references to foreign records such as:
- Product
- Product Variant
- Product Version
- Product BOM
- Inventory Item
- Inventory Reservation
- Inventory Allocation
- Inventory Movement
- Organization
- Contact or Person identity where approved
- Asset
- Document
- Knowledge
- Commerce Order
- Finance classification

Reference rules:
- foreign records remain foreign-owned
- stable identifiers only
- no foreign persistence access
- no canonical record duplication
- mandatory references fail closed
- optional references are explicit
- tenant boundaries are preserved
- references are auditable
