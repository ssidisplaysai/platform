# 02 Entity Model

Entity catalog:

1. Product
- Purpose: Canonical definition root for a sellable/buildable enterprise product.
- Canonical owner: Product Platform.
- Identity: ProductId (immutable).
- Required fields: ProductId, ProductCode, DisplayName, ProductFamilyId, CategoryId, LifecycleState, VersionIdentifier.
- Optional fields: LocalizedText, MetadataCollection, ManufacturerReference, Dimension/Weight references.
- Immutable fields: ProductId, initial ProductCode lineage anchor.
- Mutable fields: DisplayName, metadata, classification assignments, lifecycle state, version links.
- Relationships: Has variants, configurations, pricing definitions, BOM definitions, references.
- Lifecycle participation: Yes.
- Version behavior: Versioned definition lineage.
- External references: OrganizationReference, AssetReference, DocumentReference, KnowledgeReference.
- Forbidden ownership: Inventory quantity, order state, accounting state.

2. ProductVariant
- Purpose: Canonical variation of a Product definition.
- Canonical owner: Product Platform.
- Identity: ProductVariantId.
- Required fields: ProductVariantId, ProductId, SKU, VariantAttributes, LifecycleState.
- Optional fields: Barcode/GTIN/UPC, metadata.
- Immutable fields: ProductVariantId, ProductId binding.
- Mutable fields: sellability metadata, lifecycle state, version assignment.
- Relationships: Belongs to exactly one Product.
- Lifecycle participation: Yes.
- Version behavior: Version-aware under Product lineage.
- External references: Asset/Document/Knowledge references.
- Forbidden ownership: Inventory lot/serial state.

3. ProductFamily
- Purpose: Product grouping and lineage anchor.
- Canonical owner: Product Platform.
- Identity: ProductFamilyId.
- Required fields: ProductFamilyId, DisplayName.
- Optional fields: MetadataCollection.
- Immutable fields: ProductFamilyId.
- Mutable fields: display metadata and taxonomy links.
- Relationships: Parent grouping for Products.
- Lifecycle participation: Optional.
- Version behavior: Stable grouping with versioned metadata.
- External references: OrganizationReference.
- Forbidden ownership: Commerce campaign ownership.

4. Category
- Purpose: Canonical category classification.
- Canonical owner: Product Platform.
- Identity: CategoryId.
- Required fields: CategoryId, DisplayName.
- Optional fields: parent CategoryId, metadata.
- Immutable fields: CategoryId.
- Mutable fields: classification metadata.
- Relationships: Category hierarchy; Product membership.
- Lifecycle participation: Optional.
- Version behavior: Versioned taxonomy changes.
- External references: None required.
- Forbidden ownership: Analytics model ownership.

5. AttributeDefinition
- Purpose: Defines valid Product attributes.
- Canonical owner: Product Platform.
- Identity: AttributeDefinitionId.
- Required fields: key, type, cardinality, validation policy.
- Optional fields: unit metadata, localization hints.
- Immutable fields: identity and semantic key.
- Mutable fields: non-breaking metadata.
- Relationships: Referenced by AttributeValue.
- Lifecycle participation: Yes.
- Version behavior: Breaking changes require new version.
- External references: None.
- Forbidden ownership: Manufacturing execution constraints.

6. AttributeValue
- Purpose: Concrete value assignment against definitions.
- Canonical owner: Product Platform.
- Identity: AttributeValueId.
- Required fields: AttributeDefinitionId, owner entity id, value.
- Optional fields: effective metadata.
- Immutable fields: owner binding and definition binding.
- Mutable fields: value within version governance.
- Relationships: Belongs to Product or Variant.
- Lifecycle participation: Inherited.
- Version behavior: Versioned with owning entity.
- External references: None.
- Forbidden ownership: Foreign domain state.

7. OptionDefinition
- Purpose: Defines selectable options.
- Canonical owner: Product Platform.
- Identity: OptionDefinitionId.
- Required fields: key, allowed values, applicability.
- Optional fields: display metadata.
- Immutable fields: identity and key.
- Mutable fields: allowed values via version policy.
- Relationships: Used by Configuration.
- Lifecycle participation: Yes.
- Version behavior: Breaking option schema changes version.
- External references: None.
- Forbidden ownership: Commerce pricing execution behavior.

8. Configuration
- Purpose: Canonical configuration set.
- Canonical owner: Product Platform.
- Identity: ConfigurationId.
- Required fields: ProductId, configuration schema, LifecycleState.
- Optional fields: compatibility metadata.
- Immutable fields: ConfigurationId, ProductId binding.
- Mutable fields: rules and option sets under version control.
- Relationships: Uses OptionDefinition and ConfigurationRule.
- Lifecycle participation: Yes.
- Version behavior: Strongly versioned.
- External references: None.
- Forbidden ownership: Manufacturing execution routing.

9. ConfigurationRule
- Purpose: Validity constraints for configurations.
- Canonical owner: Product Platform.
- Identity: ConfigurationRuleId.
- Required fields: ConfigurationId, rule expression model.
- Optional fields: severity metadata.
- Immutable fields: identity and owner binding.
- Mutable fields: rule details by version.
- Relationships: Belongs to Configuration.
- Lifecycle participation: Inherited.
- Version behavior: Rule set version alignment required.
- External references: None.
- Forbidden ownership: Workflow execution ownership.

10. ProductRelationship
- Purpose: Canonical cross-product association.
- Canonical owner: Product Platform.
- Identity: ProductRelationshipId.
- Required fields: source ProductId, target ProductId, relationship type.
- Optional fields: effective range and priority.
- Immutable fields: source/target anchors.
- Mutable fields: relationship metadata.
- Relationships: Association across Products/Variants.
- Lifecycle participation: Yes.
- Version behavior: Version-aware.
- External references: None.
- Forbidden ownership: CRM recommendation execution.

11. ProductBundle
- Purpose: Definition of grouped products.
- Canonical owner: Product Platform.
- Identity: ProductBundleId.
- Required fields: ProductBundleId, bundle members, lifecycle state.
- Optional fields: bundle policy metadata.
- Immutable fields: identity.
- Mutable fields: membership under version governance.
- Relationships: Membership to Products/Variants.
- Lifecycle participation: Yes.
- Version behavior: Versioned structure.
- External references: None.
- Forbidden ownership: Fulfillment execution.

12. ProductKit
- Purpose: Definition of kit composition.
- Canonical owner: Product Platform.
- Identity: ProductKitId.
- Required fields: ProductKitId, components, lifecycle state.
- Optional fields: substitution metadata.
- Immutable fields: identity.
- Mutable fields: component rules by version.
- Relationships: Composition of Products/Variants.
- Lifecycle participation: Yes.
- Version behavior: Versioned kit definition.
- External references: None.
- Forbidden ownership: Warehouse allocation state.

13. ProductVersion
- Purpose: Explicit version lineage node.
- Canonical owner: Product Platform.
- Identity: ProductVersionId.
- Required fields: owning entity id, VersionIdentifier, RevisionIdentifier.
- Optional fields: release notes metadata.
- Immutable fields: owner binding and version id.
- Mutable fields: annotation metadata only.
- Relationships: Links across version graph.
- Lifecycle participation: Yes.
- Version behavior: Root of version semantics.
- External references: None.
- Forbidden ownership: Inventory revision execution.

14. LifecycleState
- Purpose: Controlled state representation for domain entities.
- Canonical owner: Product Platform.
- Identity: LifecycleStateId (or enum-coded identifier).
- Required fields: state code, transition policy.
- Optional fields: reason and policy metadata.
- Immutable fields: state code identity.
- Mutable fields: transition metadata by governance.
- Relationships: Applied to lifecycle-participating entities.
- Lifecycle participation: N/A (meta-entity).
- Version behavior: Policy versioned.
- External references: None.
- Forbidden ownership: External system execution state.

15. PricingDefinition
- Purpose: Canonical price-definition model.
- Canonical owner: Product Platform.
- Identity: PricingDefinitionId.
- Required fields: Product/ProductVariant reference, Money model, Currency, EffectiveDateRange.
- Optional fields: eligibility metadata, tier metadata.
- Immutable fields: identity and owner binding.
- Mutable fields: pricing metadata via version increments.
- Relationships: Belongs to Product/Variant.
- Lifecycle participation: Yes.
- Version behavior: Required.
- External references: Finance classifications as references only.
- Forbidden ownership: transaction pricing, discounts, tax, settlement, accounting postings.

16. BillOfMaterialDefinition
- Purpose: Canonical BOM definition model.
- Canonical owner: Product Platform.
- Identity: BillOfMaterialDefinitionId.
- Required fields: owner Product/ProductVariant id, component links, quantities.
- Optional fields: substitutions, effective range.
- Immutable fields: identity and owner binding.
- Mutable fields: component sets by version.
- Relationships: Composition definitions.
- Lifecycle participation: Yes.
- Version behavior: Required.
- External references: component Product/Variant references.
- Forbidden ownership: material consumption and manufacturing execution state.

17. AssetReference
- Purpose: Reference link to Asset Platform custody.
- Canonical owner: Product Platform (relationship only).
- Identity: AssetReferenceId.
- Required fields: Product owner id, AssetId.
- Optional fields: usage role metadata.
- Immutable fields: owner/asset binding identity.
- Mutable fields: role metadata.
- Relationships: Reference association.
- Lifecycle participation: Inherited.
- Version behavior: Reference-version aware.
- External references: AssetId.
- Forbidden ownership: binary asset custody.

18. DocumentReference
- Purpose: Reference link to Document Platform artifacts.
- Canonical owner: Product Platform (relationship only).
- Identity: DocumentReferenceId.
- Required fields: Product owner id, DocumentId.
- Optional fields: context metadata.
- Immutable fields: owner/document binding identity.
- Mutable fields: context metadata.
- Relationships: Reference association.
- Lifecycle participation: Inherited.
- Version behavior: Reference-version aware.
- External references: DocumentId.
- Forbidden ownership: document custody and revision authority.

19. KnowledgeReference
- Purpose: Reference link to Knowledge Platform content.
- Canonical owner: Product Platform (relationship only).
- Identity: KnowledgeReferenceId.
- Required fields: Product owner id, KnowledgeId.
- Optional fields: relevance metadata.
- Immutable fields: owner/knowledge binding identity.
- Mutable fields: relevance metadata.
- Relationships: Reference association.
- Lifecycle participation: Inherited.
- Version behavior: Reference-version aware.
- External references: KnowledgeId.
- Forbidden ownership: semantic governance authority.

20. OrganizationReference
- Purpose: Reference link to Organization identity context.
- Canonical owner: Product Platform (relationship only).
- Identity: OrganizationReferenceId.
- Required fields: Product owner id, OrganizationId.
- Optional fields: scope metadata.
- Immutable fields: owner/organization binding identity.
- Mutable fields: scope metadata.
- Relationships: Reference association.
- Lifecycle participation: Inherited.
- Version behavior: Reference-version aware.
- External references: OrganizationId.
- Forbidden ownership: organization canonical records.
