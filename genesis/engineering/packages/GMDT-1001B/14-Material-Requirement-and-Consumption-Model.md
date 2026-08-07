# 14 Material Requirement and Consumption Model

## MaterialRequirement

Derived from Product BOM definitions and owned by Manufacturing execution.

Required fields:
- materialRequirementId
- workOrderReference
- productOrInventoryItemReference
- bomLineReference
- requiredQuantity
- issuedQuantity
- consumedQuantity
- returnedQuantity
- scrapQuantity where applicable
- unitOfMeasure
- requiredByOperationReference
- inventoryReservationReferences
- inventoryAllocationReferences
- status
- version

## MaterialIssueRequest vs MaterialConsumptionRecord

MaterialIssueRequest:
- intent/request to Inventory
- idempotency required
- supports partial issue and substitution policy references

MaterialConsumptionRecord:
- Manufacturing fact that approved material was consumed
- immutable fact; corrections through compensating records
- variance and over or under consumption policy captured explicitly

## Rules

- partial issue and partial consumption are supported
- return-to-stock requests are explicit contract actions
- over-consumption requires approved policy path and audit evidence
- under-consumption remains explicit and traceable
- Inventory movement linkage is explicit where required
- Manufacturing does not mutate Inventory directly
