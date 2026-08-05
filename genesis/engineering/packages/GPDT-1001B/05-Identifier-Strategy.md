# 05 Identifier Strategy

Identifier classes:

1. Internal IDs
- Purpose: immutable technical identity in Product domain.
- Examples: ProductId, ProductVariantId, ProductBundleId.

2. External IDs
- Purpose: references to foreign canonical records.
- Examples: OrganizationId, AssetId, DocumentId, KnowledgeId.

3. Business identifiers
- Purpose: stable human or commercial identifiers.
- Examples: SKU, PartNumber, ProductCode.

4. Reference identifiers
- Purpose: identity of Product-owned reference relationships.
- Examples: AssetReferenceId, DocumentReferenceId, KnowledgeReferenceId, OrganizationReferenceId.

5. Version identifiers
- Purpose: lineage and revision identity.
- Examples: ProductVersionId, VersionIdentifier, RevisionIdentifier.

6. Relationship identifiers
- Purpose: identity of relationship definitions.
- Examples: ProductRelationshipId, ConfigurationRuleId.

Strategy rules:

1. Identifiers are immutable once assigned.
2. Internal IDs are globally unique within tenant-safe scope.
3. Business identifiers are stable and version-governed.
4. External identifiers preserve source ownership.
5. No identifier may imply ownership of foreign canonical state.
