# Genesis Commerce Platform Customer Contact Model

## Core Contract
Each customer contact includes:
1. Stable contactId.
2. customerId and organizationId linkage.
3. fullName and role.
4. Optional title, email, and phone.
5. preferredContact and decisionMaker flags.
6. enabled state.
7. Optional notes.
8. createdAt and updatedAt.

## Contact Roles
1. owner
2. procurement
3. operations
4. finance
5. marketing
6. technical
7. other

## Foundation Behavior
1. Preferred-contact updates demote prior preferred entries for the same customer.
2. First created contact can populate primaryContactId when missing.
3. Contact updates are constrained to mutable operational fields.

## Boundary Statement
Contact records are operational references and do not execute CRM workflows or outbound communication automation.
