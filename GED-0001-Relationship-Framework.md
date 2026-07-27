# GED-0001 Relationship Framework

## Purpose
The relationship framework defines the canonical graph connecting enterprise objects.

## Relationship Rules
1. Relationships are named and versioned.
2. Relationships must reference canonical entity keys only.
3. Relationship direction and cardinality are explicit.
4. Relationship validation fails when endpoints do not exist.

## Examples
1. Organization owns Business Units.
2. Customer receives Contacts, Quotes, Opportunities, and Sales Orders.
3. Project contains Work Orders and Manufacturing Orders.
4. Invoice is settled by Payment.
