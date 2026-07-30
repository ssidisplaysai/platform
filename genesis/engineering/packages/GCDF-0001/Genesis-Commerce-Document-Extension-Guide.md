# Genesis Commerce Document Extension Guide

## Extension Principle
Derived document types extend the framework additively and must not duplicate base infrastructure contracts.

## How To Extend
1. Reuse base identity, lifecycle, revision, party, address, line, totals, notes, metadata, and audit envelopes.
2. Add derived-specific fields under a specialization section.
3. Add derived-specific policies as separate domain rules.
4. Keep framework references as references only.

## Derived Ownership Boundaries
1. Quote owns pricing, expiration, negotiation, acceptance, conversion.
2. Sales Order owns fulfillment, shipping coordination, reservation orchestration.
3. Purchase Order owns vendor/procurement/receiving behavior.
4. Rental Agreement owns pickup/return/damage/extension behavior.
5. Service/Work Order own service and execution behavior.
6. Invoice owns financial posting and payment state behavior.
7. Credit Memo and Return Authorization own their transactional reversals and acceptance logic.

## Extension Safety Rules
1. Do not redefine lifecycle base states.
2. Do not redefine revision contracts.
3. Do not replace numbering interfaces.
4. Do not introduce workflow execution into framework layer.
5. Do not add Business Genome mutation authority to framework layer.

## Example Specialization Pattern
1. Base: GenesisCommerceDocument
2. Derived: QuoteDocument extends base with:
- quotePricingModel
- expirationPolicy
- negotiationState
- conversionPolicy

No base contract duplication is permitted.

## Versioning Strategy
1. Framework evolves slowly with backward compatibility.
2. Derived contracts absorb business velocity.
3. Breaking framework changes require constitutional package governance.
