# 02 Explicit Non-Ownership Matrix

| Capability or Record | Not Owned By Manufacturing | Canonical Owner |
|---|---|---|
| Product definition and version authority | Yes | Product |
| Product BOM definition authority | Yes | Product |
| Product pricing definition authority | Yes | Product |
| Inventory on-hand/available/reserved/allocated quantities | Yes | Inventory |
| Inventory movement and inventory ledger canonical records | Yes | Inventory |
| Commerce customer order/cart/checkout transactions | Yes | Commerce |
| CRM customer/account/opportunity authority | Yes | CRM |
| Finance accounting ledger and journal postings | Yes | Finance |
| Finance invoice/payment/tax/revenue recognition authority | Yes | Finance |
| Canonical asset identity and custody | Yes | Asset |
| Canonical document custody and revision authority | Yes | Document |
| Canonical semantic knowledge authority | Yes | Knowledge |
| Identity, employee, HR, and auth identity authority | Yes | Identity and organization platforms |
| Mission Control command authority over Manufacturing state | Yes | Manufacturing retains state authority |
| AI authority over Manufacturing canonical truth | Yes | Manufacturing approved services |

Manufacturing stores bounded references to foreign records and never assumes canonical ownership of foreign domains.
