# 06 Relationships

Relationship categories:

1. Parent/child
- Product -> ProductVariant.
- ProductFamily -> Product.

2. Composition
- ProductBundle -> BundleMembers.
- ProductKit -> KitComponents.
- BillOfMaterialDefinition -> BOMComponents.

3. Aggregation
- Product -> PricingDefinition set.
- Product -> Configuration set.

4. Reference
- Product/ProductVariant -> AssetReference.
- Product/ProductVariant -> DocumentReference.
- Product/ProductVariant -> KnowledgeReference.
- Product -> OrganizationReference.

5. Association
- ProductRelationship between Products/Variants.

6. Compatibility
- ProductRelationship type: compatible-with.

7. Replacement
- ProductRelationship type: replacement-for.

8. Supersession
- ProductRelationship type: supersedes/superseded-by.

9. Accessory
- ProductRelationship type: accessory-for.

10. Bundle membership
- ProductBundle includes Products/Variants.

11. Kit membership
- ProductKit includes Products/Variants/components.

12. Configuration applicability
- Configuration applies to Product/Variant scope.

13. Category membership
- Product belongs to Category.

Relationship rules:

1. Relationships are explicit and typed.
2. Relationship direction is canonical and deterministic.
3. Recursive invalid constructs are prohibited.
4. Relationship ownership stays in Product domain only.
