# 10 Commerce CRM Finance Boundaries

## Commerce Boundary

Commerce owns customer order, cart, checkout, and commercial fulfillment orchestration.

Manufacturing may reference Commerce demand and may be invoked through bounded contracts in future integration.

Manufacturing must not own Commerce transactions.

## CRM Boundary

CRM owns customer, account, opportunity, and customer relationship state.

Manufacturing stores references only where required.

## Finance Boundary

Finance owns accounting ledger, journal entries, valuation, cost accounting authority, invoice, payment, tax, and revenue recognition.

Manufacturing may expose execution facts such as labor time, machine time, material consumption, scrap, yield, and production output.

Manufacturing must not post accounting entries.
