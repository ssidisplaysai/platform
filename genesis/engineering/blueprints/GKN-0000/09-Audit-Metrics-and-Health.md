# 09 Audit Metrics and Health

Planned audit event model:

- KnowledgeRegistered
- KnowledgeUpdated
- KnowledgeClassified
- RelationshipAdded
- RelationshipRemoved
- KnowledgeReviewed
- KnowledgeApproved
- KnowledgePublished
- KnowledgeArchived
- LifecycleTransitioned
- ExternalReferenceLinked
- RecoveryAttempted
- RecoveryFailed

Planned metrics model:

- totalKnowledgeItems
- draftKnowledgeItems
- reviewKnowledgeItems
- approvedKnowledgeItems
- publishedKnowledgeItems
- archivedKnowledgeItems
- taxonomyNodesTotal
- relationshipsTotal
- publicationEventsTotal
- auditEventsTotal
- recoveryCount
- corruptStateCount

Planned health model:

- status: HEALTHY | DEGRADED
- checks: persistence, registry, taxonomy, graph, publication, lifecycle, integrations, observability
- detail messages for every check

Observability philosophy:

- Audit, metrics, and health provide explainability and operational confidence.
- Observability informs governance without assuming business ownership.
