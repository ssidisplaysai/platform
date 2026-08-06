# 06 Dependency Matrix

Dependency classification:

1. Inventory -> Product: REQUIRED REFERENCE DEPENDENCY
- Purpose: canonical product identity and definition reference.
- Ownership transfer: NONE.

2. Inventory -> Shared Platform Framework: REQUIRED INFRASTRUCTURE DEPENDENCY
- Purpose: runtime, persistence coordination, observability, validation, utility mechanics.
- Ownership transfer: NONE.

3. Inventory -> Manufacturing: COORDINATION DEPENDENCY
- Purpose: reservation/availability/stock transitions driven by manufacturing requests.
- Ownership transfer: NONE.

4. Inventory -> Commerce: COORDINATION DEPENDENCY
- Purpose: availability and reservation/allocation support for commerce flow.
- Ownership transfer: NONE.

5. Inventory -> CRM: OPTIONAL REFERENCE DEPENDENCY
- Purpose: contextual references only.
- Ownership transfer: NONE.

6. Inventory -> Finance: OPTIONAL REFERENCE/REPORTING DEPENDENCY
- Purpose: valuation/accounting coordination inputs.
- Ownership transfer: NONE.

7. Inventory -> Asset: OPTIONAL REFERENCE DEPENDENCY
- Purpose: asset linkage references.
- Ownership transfer: NONE.

8. Inventory -> Document: OPTIONAL REFERENCE DEPENDENCY
- Purpose: document linkage references.
- Ownership transfer: NONE.

9. Inventory -> Knowledge: OPTIONAL SEMANTIC REFERENCE DEPENDENCY
- Purpose: semantic context references.
- Ownership transfer: NONE.

10. Inventory -> Mission Control: OBSERVATION DEPENDENCY
- Purpose: publish read-only observations.
- Ownership transfer: NONE.

Anti-dependency constraints:

1. Inventory must not own external canonical definitions.
2. External platforms must not own Inventory quantities or state lifecycle.
3. Shared framework dependency does not authorize Inventory to redefine infrastructure ownership.