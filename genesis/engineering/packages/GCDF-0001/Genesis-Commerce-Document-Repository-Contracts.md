# Genesis Commerce Document Repository Contracts

## Contract Scope
These are provider-facing interfaces only. No repository implementation is included in GCDF-0001.

## Document Repository Contract
Capabilities required:
1. getById(documentId)
2. getByNumber(documentNumber)
3. list(filters, pagination)
4. create(document)
5. update(documentId, patch, expectedVersion)
6. transitionLifecycle(documentId, transition, expectedVersion)
7. appendRevision(documentId, revisionRecord, expectedVersion)
8. getRevision(documentId, revisionNumber)
9. listRevisions(documentId)
10. exists(documentId)

## Number Provider Contract
1. reserveNumber(documentType, organizationId, context)
2. peekNextNumber(documentType, organizationId)
3. validateNumberFormat(documentType, value)

Note: provider defines final numbering semantics.

## Revision Provider Contract
1. computeNextRevision(document)
2. summarizeChange(previous, next)
3. buildRevisionRecord(previous, next, authorReference, correlationId)

## Approval Provider Contract
1. requestApproval(documentId, payload)
2. evaluateApproval(documentId)
3. recordApprovalDecision(documentId, decision)

No workflow execution behavior is defined here.

## Attachment Provider Contract
1. createAttachmentReference(documentId, descriptor)
2. deleteAttachmentReference(documentId, attachmentId)
3. listAttachmentReferences(documentId)

No binary storage behavior is defined here.

## Print Provider Contract
1. renderDocument(documentId, templateId, locale)
2. renderRevision(documentId, revisionNumber, templateId, locale)

No PDF engine behavior is defined here.

## Export Provider Contract
1. exportDocument(documentId, targetFormat, options)
2. exportRevision(documentId, revisionNumber, targetFormat, options)

## Audit Provider Contract
1. recordEvent(event)
2. listEvents(documentId, filters)
3. summarizeEvents(documentId)

## Authorization and Boundary Alignment
1. Repository methods are authorization-aware through caller context contracts.
2. Contracts remain compatible with existing repository abstraction/provider model.
3. Contracts do not declare or perform transactional business behavior.
