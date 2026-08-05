# 03 Aggregates

Aggregate roots:

1. Product (aggregate root)
- Owns: ProductVariant, ProductVersion, ProductRelationship anchors, AssetReference, DocumentReference, KnowledgeReference, OrganizationReference.
- Transactional boundary: Product identity and its immediate definition consistency.
- Consistency boundary: Variant membership, lifecycle compatibility, and reference integrity.
- Ownership boundary: Product-domain definition only.

2. Configuration (aggregate root)
- Owns: ConfigurationRule, option bindings, applicability metadata.
- Transactional boundary: Configuration and rule consistency in a single unit.
- Consistency boundary: No rule cycles and valid option-definition references.
- Ownership boundary: Definition only, no runtime execution behavior.

3. BillOfMaterialDefinition (aggregate root)
- Owns: component definition entries and substitution definitions.
- Transactional boundary: BOM graph definition updates.
- Consistency boundary: Acyclic component graph and valid component references.
- Ownership boundary: Definition only, no consumption/execution ownership.

4. PricingDefinition (aggregate root)
- Owns: pricing tiers, eligibility metadata, effective range metadata.
- Transactional boundary: Pricing definition version set.
- Consistency boundary: currency consistency and non-overlapping incompatible ranges.
- Ownership boundary: Definition only, no transaction pricing ownership.

5. ProductBundle (aggregate root)
- Owns: bundle membership definitions.
- Transactional boundary: bundle structure update.
- Consistency boundary: no self-recursion, membership validity.
- Ownership boundary: definition only.

6. ProductKit (aggregate root)
- Owns: kit component definitions and substitution metadata.
- Transactional boundary: kit structure update.
- Consistency boundary: no self-recursion, valid component links.
- Ownership boundary: definition only.

Entities that may never exist independently:

1. ProductVariant (must belong to one Product).
2. AttributeValue (must belong to Product or ProductVariant).
3. ConfigurationRule (must belong to one Configuration).
4. AssetReference (must belong to Product or ProductVariant context).
5. DocumentReference (must belong to Product or ProductVariant context).
6. KnowledgeReference (must belong to Product or ProductVariant context).
7. OrganizationReference (must belong to Product scope).

Aggregate ownership rules:

1. Cross-aggregate references must use stable identifiers.
2. Cross-aggregate updates require version-aware coordination semantics.
3. No aggregate may claim external platform execution ownership.
