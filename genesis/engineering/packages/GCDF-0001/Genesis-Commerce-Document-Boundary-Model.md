# Genesis Commerce Document Boundary Model

## Boundary Purpose
Define strict ownership boundaries between framework infrastructure and transactional business modules.

## Framework-Included Responsibilities
1. Canonical document structure and contracts.
2. Structural lifecycle transitions.
3. Revision and change lineage contracts.
4. Parties, addresses, and references scaffolding.
5. Provider interfaces for numbering/approval/attachments/print/export/audit.

## Framework-Excluded Responsibilities
1. Pricing and discount logic.
2. Tax computation and freight computation.
3. Inventory reservation and allocation.
4. Shipment execution and fulfillment control.
5. Invoice ledger posting and settlement logic.
6. Notification sending.
7. Workflow execution.
8. AI generation.
9. Content publication.
10. Business Genome mutation.
11. Marketing Kernel execution.

## Reference Domain Boundaries
Framework stores references only to:
1. customers
2. products
3. inventory entities
4. sites
5. integration profiles
6. Business Genome entities
7. marketing entities

Framework does not own source-of-truth data for those domains.

## Security and Governance Boundaries
1. Authorization enforcement remains at application/service boundaries.
2. Audit hooks are provided but audit policy execution remains external.
3. Cross-reference is structural only; it does not imply execution authorization.

## Compliance Statement
GCDF-0001 is architecture only and introduces no transactional functionality.
