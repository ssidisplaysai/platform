# 07 Lifecycle Retention Archive Delete Restore

Lifecycle states:

- ACTIVE
- ARCHIVED
- SOFT_DELETED

Operations:

- archive
- softDelete
- restore

Retention enforcement:

- legal hold blocks soft delete
- retain-until timestamp blocks soft delete until expiration
- retention policy metadata persisted on each asset
