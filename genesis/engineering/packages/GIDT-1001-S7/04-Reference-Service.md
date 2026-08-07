# 04 Reference Service

Implemented InventoryReferenceService:
- validate(reference, commandMetadata)
- validateMany(references, commandMetadata)
- validateInventoryItemProductReference(input, commandMetadata)
- getMetrics()
- getHealth()

Behavior:
- Mandatory references fail closed
- Optional references do not block command progression
- Missing optional validator produces evidence without hard failure
