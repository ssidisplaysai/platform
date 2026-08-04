# 03 Organization Domain Model

Canonical contracts implemented:
- OrganizationId
- OrganizationType
- OrganizationStatus
- Organization
- BusinessUnit
- Brand
- Division
- Location
- Department
- Tenant
- OrganizationMetadata
- OrganizationSettings
- OrganizationLifecycle and transitions
- OrganizationAuditRecord
- OrganizationMetricsSnapshot

Domain model notes:
- Status transitions are lifecycle-validated.
- Metadata and settings are independently managed.
- Audit and metrics are first-class structures.
