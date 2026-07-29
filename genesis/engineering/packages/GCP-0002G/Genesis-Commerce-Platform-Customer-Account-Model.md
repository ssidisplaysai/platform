# Genesis Commerce Platform Customer Account Model

## Core Contract
Each customer account includes:
1. Stable customerId.
2. organizationId scope.
3. accountName and optional legalName.
4. accountCode unique within organization scope.
5. accountType and lifecycleState.
6. enabled state.
7. primarySiteId and associatedSiteIds.
8. primaryContactId, billingAddressId, and shippingAddressId linkage.
9. communicationPreferences (email/sms/phone/marketing/operational/invoice/frequency/timezone).
10. taxExempt flag, tags, and notes.
11. createdAt and updatedAt.

## Lifecycle States
1. prospect
2. active
3. inactive
4. suspended
5. archived

## Account Types
1. direct
2. dealer
3. distributor
4. partner
5. internal
6. other

## Foundation Storage Model
1. Fixture-backed in-memory map for deterministic package behavior.
2. Organization-scoped duplicate checks on accountCode and accountName.
3. Generated account identifiers are slug-derived and collision-checked.

## Boundary Statement
This model defines application foundation records only and does not execute downstream commerce transactions.
