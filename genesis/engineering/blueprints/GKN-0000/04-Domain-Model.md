# 04 Domain Model

Canonical planned knowledge entities:

1. Knowledge Article
- Primary semantic knowledge unit.

2. Knowledge Node
- Graph-addressable semantic node used in relationship modeling.

3. Category
- Canonical classification dimension.

4. Tag
- Flexible labeling dimension.

5. Topic
- Domain grouping concept for discoverability and governance.

6. Relationship
- Directed or typed semantic link between knowledge nodes.

7. Publication
- Knowledge publication context and status record.

8. Revision Reference
- Reference to external or internal revision provenance; does not own document revision chains.

9. Knowledge Graph
- Aggregated node-edge semantic structure owned by Knowledge Platform.

10. Knowledge Collection
- Curated grouping of knowledge entities.

11. Knowledge Link
- Explicit reference linkage to external platform artifacts via contract identifiers.

12. Knowledge Citation
- Source attribution metadata for evidence and traceability.

13. Knowledge Source
- Origin descriptor for knowledge derivation.

14. Knowledge Owner
- Ownership assignment metadata bound to organizational/contact references.

15. Knowledge Review
- Review lifecycle record for quality and governance posture.

16. Knowledge Approval
- Approval lifecycle record for publishable knowledge state.

17. Knowledge State
- Canonical lifecycle state representation for deterministic transitions.

Domain model constraints:

- One canonical owner per concept.
- Semantic ownership remains distinct from document/asset custody.
- Cross-platform references use contract identifiers only.
