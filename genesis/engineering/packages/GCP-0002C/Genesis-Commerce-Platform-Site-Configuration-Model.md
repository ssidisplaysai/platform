# Genesis Commerce Platform Site Configuration Model

## Model Contract
Application-level `SiteConfiguration` includes:
1. siteId
2. organizationId
3. siteName
4. displayName
5. slug
6. domain
7. canonicalUrl
8. environment
9. lifecycleState
10. enabled
11. healthStatus
12. publishingStatus
13. defaultContentType
14. defaultPublicationStatus
15. defaultAuthorReference
16. defaultCategoryReferences
17. integrations.wordpressApiBaseUrl
18. integrations.wordpressCredentialReference
19. integrations.workflowReference
20. profiles.promptProfileReference
21. profiles.imageProfileReference
22. profiles.seoProfileReference
23. profiles.brandProfileReference
24. profiles.analyticsProfileReference
25. lastConnectionTest
26. lastSuccessfulPublication
27. lastHealthCheck
28. createdAt
29. updatedAt
30. notes

## Secret Handling
1. Model stores opaque credential references only.
2. Model excludes password/api-key secret fields.
3. Integration references are non-secret identifiers.

## Fixture Persistence Boundary
1. Repository implementation is fixture-backed/in-memory for bounded package scope.
2. No new database layer was introduced.
3. Persistence architecture blocker for production storage remains external to this package.

## Stable Identifier Policy
1. Site IDs use deterministic stable tokens.
2. Site ID is immutable after creation.
3. Organization reassignment through site update is rejected.
