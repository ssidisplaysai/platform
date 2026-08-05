# 06 Reference Boundary Assurance

Reference assurance outcomes:

1. AssetReference mandatory assetId enforced.
2. DocumentReference mandatory documentId enforced.
3. KnowledgeReference mandatory knowledgeId enforced.
4. OrganizationReference mandatory organizationId enforced.
5. Tenant/product binding mismatches reject deterministically.
6. Invalid references increment invalidReferenceCount observability counter.
7. Invalid references emit rejection audit evidence.
8. Failed reference mutations do not partially mutate canonical Product state.
9. Reference handling remains foreign-reference-only; no foreign canonical duplication.

Dependency boundary:

- No foreign platform persistence internals imported.
