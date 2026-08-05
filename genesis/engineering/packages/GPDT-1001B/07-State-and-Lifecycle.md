# 07 State and Lifecycle

Lifecycle states:

1. Draft
2. Proposed
3. Approved
4. Active
5. Deprecated
6. Retired
7. Archived

Legal transitions:

1. Draft -> Proposed
2. Proposed -> Approved
3. Approved -> Active
4. Active -> Deprecated
5. Deprecated -> Retired
6. Retired -> Archived

Allowed alternate governance transitions:

1. Draft -> Archived (cancellation path)
2. Proposed -> Archived (rejected proposal path)
3. Approved -> Deprecated (policy-driven deprecation before activation)

Prohibited transitions:

1. Archived -> Active
2. Retired -> Active
3. Deprecated -> Proposed
4. Active -> Draft

Lifecycle participation:

1. Product: required.
2. ProductVariant: required.
3. Configuration: required.
4. PricingDefinition: required.
5. BillOfMaterialDefinition: required.
6. ProductBundle: required.
7. ProductKit: required.
8. ProductRelationship: optional policy-based participation.

Lifecycle governance notes:

1. Transition reason and actor metadata required for auditable changes.
2. Version-aware transitions required where state impacts contract behavior.
