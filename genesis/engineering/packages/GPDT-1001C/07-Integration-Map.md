# 07 Integration Map

Consumer-only integration points:

1. Identity
- Use subject identity for audit attribution.

2. Authorization
- Enforce command/query authorization checks.

3. Organization
- Validate OrganizationReference identifiers.

4. Asset
- Validate AssetReference identifiers and status projections.

5. Document
- Validate DocumentReference identifiers and status projections.

6. Knowledge
- Validate KnowledgeReference identifiers and status projections.

7. Workflow
- Optional Product lifecycle workflow triggers by contract.

8. Messaging/Notification
- Optional consumer notifications for Product change events.

Optional integrations:

1. Scheduling
- Deferred lifecycle actions by contract.

2. AI Orchestration
- Advisory enrichment observations only.

3. Analytics projection
- Product read-model exports only.

Mission Control observation points:

1. Health endpoint contracts.
2. Metrics endpoint contracts.
3. Audit projection feed.

AI observation points:

1. Product definition quality signals.
2. Missing metadata recommendation candidates.
3. Configuration consistency recommendation candidates.

Forbidden integration patterns:

1. Cross-platform internal imports.
2. Direct foreign persistence access.
3. Foreign ownership re-materialization in Product state.
