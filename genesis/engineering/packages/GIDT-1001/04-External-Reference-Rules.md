# 04 External Reference Rules

Reference authority rules:

1. Inventory may reference Product only through stable Product identifiers.
2. Inventory may reference Asset records only through stable Asset identifiers.
3. Inventory may reference Document records only through stable Document identifiers.
4. Inventory may reference Knowledge records only through stable Knowledge identifiers.
5. Inventory must not materialize canonical external definitions inside Inventory-owned state.

Cross-platform reference constraints:

1. No Inventory-owned duplication of Product definition or Product metadata.
2. No Inventory-owned duplication of Manufacturing work-order definitions.
3. No Inventory-owned duplication of Commerce order/cart/checkout ownership.
4. No Inventory-owned duplication of CRM customer/account/contact ownership.
5. No Inventory-owned duplication of Finance ledger/accounting ownership.

Mutation authority rules:

1. Inventory may mutate only Inventory-owned concepts.
2. External platform entities are read/referenced by Inventory, not owned or canonically mutated by Inventory.
3. Cross-platform state change requests must target the canonical owning platform.

Interoperability rules:

1. Reference identity formats are platform contracts, not Inventory ownership.
2. Inventory lifecycle events may include external identifiers as references only.
3. External identifiers are not sufficient to transfer canonical ownership.