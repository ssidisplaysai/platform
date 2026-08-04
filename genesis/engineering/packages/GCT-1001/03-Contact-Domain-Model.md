# 03 Contact Domain Model

## Core Identity
- Contact keys: `contactId`, `tenantId`, `organizationId`
- Lifecycle status: `ACTIVE`, `INACTIVE`, `ARCHIVED`, `MERGED`, `DECEASED`, `BLOCKED`
- Person name normalization and display model are canonicalized in registry/identity services.

## Bounded Records
- Classifications: versioned classification records
- Methods: email, phone, postal with normalized value and lifecycle attributes
- Affiliations: organization-linked role records with tenant ownership
- Preferences: versioned communication preferences
- Consent history: append-only timeline
- Identity links: provider/subject and optional external identifier
- Merge history: explicit source-target merge records

## Versioning and Audit
- Each mutation increments contact version and appends `versionHistory` entry.
- Audit stream is append-oriented through `ContactAuditWriter` with durable persistence.
