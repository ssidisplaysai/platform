# Recovery Validation

Result: PASS.

First run, malformed JSON, unsupported schema, invalid manifest, tenant mismatch, duplicate work order, duplicate work order number, invalid lifecycle, quantity corruption, routing cycle, broken routing reference, invalid operation relationship, material corruption, output/WIP corruption, resource corruption, downtime corruption, trace corruption, invalid idempotency, invalid version state, and reconciliation restoration were all exercised. READY remains blocked after blocking recovery failures.
