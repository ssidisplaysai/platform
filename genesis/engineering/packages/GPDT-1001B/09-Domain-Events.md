# 09 Domain Events

Conceptual domain events (definition only):

1. ProductCreated
2. ProductUpdated
3. ProductVersionPublished
4. ProductLifecycleChanged
5. VariantCreated
6. VariantUpdated
7. CategoryAssigned
8. CategoryRemoved
9. ConfigurationCreated
10. ConfigurationChanged
11. ConfigurationRuleChanged
12. PricingDefinitionUpdated
13. PricingDefinitionVersionPublished
14. BillOfMaterialDefinitionUpdated
15. BundleCreated
16. BundleUpdated
17. KitCreated
18. ProductRelationshipDefined
19. ProductRelationshipRemoved
20. ProductRetired

Event modeling constraints:

1. Events are conceptual engineering events only.
2. Events do not transfer canonical ownership.
3. Events must preserve deterministic aggregate causality ordering.
4. Event schemas must align with versioned contract strategy.

Non-goals:

1. No runtime event bus design.
2. No delivery guarantees implementation.
3. No event-store implementation.
