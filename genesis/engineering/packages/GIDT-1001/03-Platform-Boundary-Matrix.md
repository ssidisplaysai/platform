# 03 Platform Boundary Matrix

Product boundary:

1. Product owns: identity, definition, attributes, versions, metadata, configuration, pricing definition, BOM definition.
2. Inventory owns: physical quantity, physical state, stock location, warehouse assignment, reservation state, allocation state, movement history, lot, serial, expiration.
3. Constraint: Inventory references Product only by stable Product identifiers.
4. Constraint: Inventory must never duplicate Product definitions.

Manufacturing boundary:

1. Manufacturing owns: work orders, routing, production execution, consumption, production output, machine state, labor execution.
2. Inventory owns: material availability, material reservations, finished goods quantity, warehouse state.
3. Interaction rule: Manufacturing requests Inventory changes.
4. Canonical state rule: Inventory remains owner of stock state.

Commerce boundary:

1. Commerce owns: orders, cart, checkout, shipment orchestration, fulfillment workflow.
2. Inventory owns: availability, reservation, allocation, stock movement.
3. Constraint: Commerce never owns inventory quantities.

CRM boundary:

1. CRM owns: customers, accounts, contacts, opportunities.
2. Inventory owns: inventory only.

Finance boundary:

1. Finance owns: ledger, cost accounting, valuation, invoice, payment, tax.
2. Inventory owns: operational inventory state only.

Asset boundary:

1. Asset platform owns assets.
2. Inventory references assets.

Document boundary:

1. Document platform owns documents.
2. Inventory references documents.

Knowledge boundary:

1. Knowledge platform owns semantics.
2. Inventory references knowledge.

Mission Control boundary:

1. Inventory publishes observations only.
2. Mission Control owns no Inventory state.
3. Inventory retains canonical state ownership.