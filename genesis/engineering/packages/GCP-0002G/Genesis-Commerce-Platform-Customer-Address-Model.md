# Genesis Commerce Platform Customer Address Model

## Core Contract
Each customer address includes:
1. Stable addressId.
2. customerId and organizationId linkage.
3. label and addressType.
4. line1, optional line2, city, region, postalCode, and countryCode.
5. Optional siteId association.
6. defaultBilling and defaultShipping flags.
7. enabled state.
8. Optional notes.
9. createdAt and updatedAt.

## Address Types
1. billing
2. shipping
3. service
4. headquarters
5. other

## Foundation Behavior
1. Promoting a new default billing or shipping address demotes prior defaults for the same customer.
2. Customer billingAddressId and shippingAddressId are synchronized from address defaults.
3. Address identity generation is deterministic and collision-checked.

## Boundary Statement
Address records define customer routing context only and do not execute tax, shipping, or fulfillment operations.
