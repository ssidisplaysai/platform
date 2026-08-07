# 17 WIP and Execution State Architecture

WIP is Manufacturing execution state and projection, not Inventory balance.

WIP tracks:
- Work Order
- operation
- quantity waiting
- quantity in process
- quantity completed
- quantity rejected
- hold state
- Work Center
- traceability linkage

When output becomes Inventory-recognized stock:
- only after the approved Inventory receipt/movement contract completes and returns the required bounded reference

WIP rules:
- WIP state transitions are derived from execution facts and operation status
- WIP can be projected and summarized without owning stock authority
- WIP drift is a recoverable inconsistency that must be detected, not ignored
