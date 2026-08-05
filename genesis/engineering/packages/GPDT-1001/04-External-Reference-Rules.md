# 04 External Reference Rules

Allowed external references:

1. Organization IDs
2. Asset IDs
3. Document IDs
4. Knowledge IDs
5. Workflow IDs
6. Category IDs
7. Product IDs
8. Variant IDs
9. Product Family IDs
10. Configuration IDs
11. BOM Definition IDs
12. Pricing Definition IDs

External reference requirements:

1. Stable identifiers only.
2. Source ownership preserved.
3. Validation through approved contracts where required.
4. No duplication of foreign canonical records.
5. Fail-closed behavior when mandatory references are invalid.
6. Tenant-safe behavior.
7. Auditable reference lifecycle.

Product pricing boundary:

Product may own:

1. Base price definition.
2. List-price definition.
3. Pricing model reference.
4. Pricing tier definition.
5. Effective-date metadata.
6. Currency applicability metadata.
7. Price eligibility metadata.

Product shall not own:

1. Transaction pricing execution.
2. Discount execution.
3. Promotional calculation.
4. Tax calculation.
5. Invoice calculation.
6. Payment settlement.
7. Accounting posting.
8. Revenue recognition.

Product BOM boundary:

Product may own:

1. Canonical BOM definition.
2. Component relationships.
3. Quantity definitions.
4. Configuration applicability.
5. Effective dates.
6. Approved substitutions.
7. Versioned BOM structure.

Product shall not own:

1. Work-order material consumption.
2. Production execution.
3. Routing execution.
4. Labor execution.
5. Scrap recording.
6. Yield recording.
7. Inventory depletion.
8. Warehouse allocation.
9. Manufacturing scheduling.

Product asset boundary:

Product may own:

1. Relationship between Product and Asset reference.

Product shall not own:

1. Binary files.
2. Image storage.
3. Video storage.
4. Checksum custody.
5. Storage provider behavior.
6. Asset retention.
7. Asset version custody.

Product document boundary:

Product may own:

1. Relationship between Product and Document reference.

Product shall not own:

1. Document revision custody.
2. Document approval.
3. Document signatures.
4. Document storage.
5. Document lifecycle authority.

Product knowledge boundary:

Product may reference:

1. Product knowledge articles.
2. Installation guidance.
3. Product FAQs.
4. Compatibility guidance.
5. Service procedures.
6. Product policies.
7. Product training.

Product shall not own:

1. Semantic knowledge governance.

Canonical authority retention:

1. Asset Platform retains binary custody.
2. Document Platform retains document artifact custody and revision authority.
3. Knowledge Platform retains semantic and governance authority.
4. Commerce and Finance retain transaction and financial execution authority.
5. Manufacturing and Inventory retain execution and stock authority.
