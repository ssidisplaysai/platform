# Genesis Commerce Document Model

## Canonical Aggregate
GenesisCommerceDocument is the canonical transactional document base model for Genesis Commerce Platform.

## Identity Envelope
1. documentId
2. documentNumber
3. organizationId
4. owningApplicationId
5. createdAt
6. updatedAt
7. version
8. revision

## Lifecycle Envelope
1. lifecycleState: Draft | PendingReview | Approved | Rejected | Active | Closed | Archived | Cancelled
2. operationalStatus: document-type-specific status value
3. approvalStatus: approval state value
4. publicationStatus: rendering/export publication state value
5. executionStatus: downstream execution state value

## Parties Envelope
1. customerReference
2. customerContactReferences[]
3. salesRepresentativeReference
4. internalOwnerReference

## Address Envelope
1. billingAddress
2. shippingAddress
3. installationAddress
4. serviceAddress

## Commercial Envelope
1. currencyCode
2. exchangeRate
3. paymentTermsReference
4. freightTermsReference

## Line Collection Contract
1. lines[]: abstract line records only
2. line record required fields:
- lineId
- productReference (nullable for service/meta lines)
- siteReference (optional)
- quantity
- unitOfMeasure
- sequence
- metadata
3. No pricing rules in base contract.

## Financial Totals Envelope
1. subtotalAmount
2. discountAmount
3. taxAmount
4. shippingAmount
5. feeAmount
6. grandTotalAmount

## Attachment Envelope
1. attachments[] containing:
- attachmentId
- providerReference
- mediaType
- fileName
- sizeBytes
- checksum
- createdAt
- createdBy

## Notes Envelope
1. internalNotes[]
2. externalNotes[]

## Audit Envelope
1. createdBy
2. updatedBy
3. changeEvents[]
4. correlationId

## Metadata Envelope
1. metadata: application-defined key-value contract
2. tags[]
3. customAttributes

## Cross-Reference Envelope
1. sourceDocumentReferences[]
2. derivedDocumentReferences[]
3. relatedDocumentReferences[]

## Reference-Only Rule
The model stores references to:
1. customers
2. products
3. inventory entities
4. sites
5. integration profiles
6. Business Genome entities
7. marketing entities

The model does not own those domains.
