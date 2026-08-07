# 14 Production Output Architecture

Output sequence:
1. validate Work Order and operation
2. validate Product reference
3. validate output quantity and disposition
4. create proposed Manufacturing output fact
5. request Inventory finished-goods receipt where approved
6. receive Inventory movement or receipt reference
7. finalize Manufacturing output fact
8. update Work Order and operation totals
9. update WIP
10. audit
11. persist
12. observe

Rules:
- Manufacturing owns the completion fact
- Inventory owns physical stock result
- output is not finalized as stock-complete until required Inventory acceptance semantics are satisfied

Disposition model:
- completed units
- rejected units
- scrap
- rework
- byproduct where approved
- finished goods
- intermediate or WIP output
