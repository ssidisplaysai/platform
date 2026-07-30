# Genesis Commerce Platform Customer Permissions

## Customer Surface Permissions
1. customers:read
2. customers:create
3. customers:update
4. customers:archive
5. customers:evaluate_readiness
6. customers:detect_duplicates
7. customers:view_activity

## Contact Surface Permissions
1. contacts:read
2. contacts:create
3. contacts:update

## Address Surface Permissions
1. addresses:read
2. addresses:create
3. addresses:update

## Role Mapping Intent
1. platform_admin and ops_manager can perform full customer/contact/address foundation operations.
2. company_operator can perform operational create/update/read/evaluate/detect customer flows.
3. analyst can read customer surfaces and evaluate readiness/duplicates/activity for governed review.
4. viewer is intentionally restricted from write and evaluation actions.

## Enforcement Pattern
All customer API handlers enforce permission checks via role header mapping before performing reads or writes.
