# 21 External Reference Validation Architecture

Validator registry responsibilities:
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

Validation policy:
- mandatory, optional, or deferred classification is explicit per reference type
- validation timing occurs at command admission, recovery, and selected read projections
- tenant behavior is strict and mismatch-safe
- stale reference behavior fails closed
- unavailable-validator behavior degrades health and blocks readiness for mandatory paths
- startup and recovery validate required validators before command admission

Evidence plan for future GIDT-CERT-C001 support:
- future Manufacturing work order validation paths can exercise valid, invalid, tenant mismatch, inactive/closed, and unavailable-validator cases without changing Inventory
