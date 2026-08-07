# 08 Production Output Boundary

## Manufacturing Completion Fact Ownership

Manufacturing is canonical owner for production completion facts including:
- units completed
- units rejected
- scrap
- rework
- yield

## Inventory Stock Mutation Ownership

Inventory remains canonical owner of resulting stock changes.

Manufacturing must request finished-goods receipt and other stock-impacting actions through Inventory contracts.

Manufacturing may not directly increase Inventory balances.
