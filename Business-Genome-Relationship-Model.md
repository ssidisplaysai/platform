# Business Genome Relationship Model

Program: BGP-0001  
Status: FOUNDATION

## Relationship Taxonomy
1. owns
2. belongs_to
3. contains
4. depends_on
5. references
6. manufactured_by
7. purchased_by
8. sold_to
9. managed_by
10. governed_by
11. supported_by
12. derived_from
13. implements
14. uses
15. replaces
16. reports_to
17. approved_by
18. connected_to
19. served_by
20. located_at
21. installed_at

## Relationship Contract
Each relationship SHALL define:
1. Relationship Identifier
2. Source Object Identifier
3. Target Object Identifier
4. Relationship Type
5. Effective Date
6. Lifecycle State
7. Evidence References
8. Confidence Score
9. Version
10. Governance Metadata

## Cardinality Rules
1. one-to-one
2. one-to-many
3. many-to-one
4. many-to-many

## Integrity Rules
1. Relationship endpoints SHALL reference valid canonical object identifiers.
2. Relationship type SHALL be selected from approved taxonomy.
3. Relationship mutations SHALL create new versions, never rewrite certified history.

## Relationship Statistics
1. Relationship types: 21
2. Required relationship attributes: 10
