# Genesis Commerce Platform Customer Validation

## Validation Coverage
1. Customer create/update payload shape and required-field checks.
2. Contact create/update payload checks including role and reachable contact fields.
3. Address create/update payload checks including country and location fields.
4. Duplicate account guardrails for accountCode and accountName in organization scope.
5. Referential integrity checks across customer primaryContactId, billingAddressId, and shippingAddressId links.

## Security and Data Hygiene Rules
1. Secret-like inline values are rejected for customer/contact/address records.
2. Credential-like and token-like payload patterns are rejected.
3. Email and country format checks are validated before persistence.
4. Site references are validated against known site records for bounded consistency.

## Mutation Constraints
1. Immutable identity and scope fields are not patchable through update paths.
2. Updates preserve deterministic structure and only mutate allowed operational fields.

## Boundary Statement
Validation guards are bounded to application-foundation data quality and do not infer authority over external systems.
