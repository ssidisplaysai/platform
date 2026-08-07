# 03 Product Boundary

## Product Is Canonical Design Authority

Product remains canonical owner for:
- Product
- Product Variant
- Product Configuration
- Product Version
- Product Attributes
- Product BOM Definition
- Product Pricing Definition
- Product Relationships
- Product Metadata

## Manufacturing Consumption Model

Manufacturing consumes Product definitions through bounded references and may record:
- immutable Product version reference for traceability
- execution-time BOM instance or frozen reference used at execution start
- authorized substitution facts when explicitly allowed by policy

## Ownership Prohibitions

Manufacturing must not:
- become canonical owner of Product BOM definition
- redefine Product version authority
- assume Product design governance

Product remains canonical design authority across all Manufacturing execution scenarios.
