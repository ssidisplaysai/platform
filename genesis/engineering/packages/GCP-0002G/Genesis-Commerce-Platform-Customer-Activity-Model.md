# Genesis Commerce Platform Customer Activity Model

## Activity Types
1. customer_created
2. customer_updated
3. customer_archived
4. customer_readiness_evaluated
5. contact_created
6. contact_updated
7. address_created
8. address_updated
9. duplicate_scan_requested

## Activity Record Contract
1. activityId
2. customerId
3. organizationId
4. type
5. actor
6. createdAt
7. summary

## Foundation Behavior
1. Activity entries are append-on-event and listed per-customer for review.
2. Activity logging captures API and repository-level bounded operations only.
3. Test reset helper exists to keep deterministic suite behavior.

## Boundary Statement
Activity records are package-local operational evidence and do not replace enterprise audit authority.
