# 13 Material Requirement and Consumption Architecture

MaterialRequirement runtime flow:
1. validate Work Order Product and BOM baseline
2. derive execution requirements from approved BOM reference
3. preserve BOM source lineage and contract version
4. freeze approved requirement baseline for Work Order execution
5. track substitutions and variance separately
6. never rewrite Product BOM definition

Runtime model:
- requirement identity is Manufacturing-owned
- BOM lineage is retained as immutable reference metadata
- required, issued, consumed, returned, and variance quantities are versioned
- operation applicability is explicit
- Inventory reservation/allocation references are attached as bounded references only

Execution ownership:
- MaterialIssueRequest is intent/request to Inventory
- MaterialConsumptionRecord is Manufacturing fact of executed consumption
- Inventory owns stock mutation, reservation, allocation, and movement

Reconciliation behavior:
- issue failure does not create false consumption
- consumption cannot silently exceed approved policy
- returns and variance are explicit and auditable
