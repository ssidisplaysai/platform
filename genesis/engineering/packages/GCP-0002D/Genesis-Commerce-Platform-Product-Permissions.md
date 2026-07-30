# Genesis Commerce Platform Product Permissions

## Product and Catalog Permission Set
1. products:read
2. products:create
3. products:update
4. products:archive
5. products:manage_categories
6. products:manage_manufacturers
7. products:manage_specifications
8. products:assign_sites
9. products:evaluate_readiness
10. products:view_internal
11. products:view_audit

## Role Mapping Summary
1. platform_admin: full product/catalog capability set.
2. ops_manager: full product/catalog capability set for operational governance.
3. company_operator: read/create/update + site assignment/spec/readiness + internal view.
4. analyst: read/readiness/internal view/audit view.
5. viewer: no product/catalog write or readiness privileges.
