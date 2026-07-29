# Genesis Sales Order Authorization

## Permission Model
Implemented permissions:
- `orders:read`
- `orders:create`
- `orders:update`
- `orders:approve`
- `orders:release`
- `orders:revise`
- `orders:cancel`
- `orders:view_audit`

## Role Coverage
Required role archetypes and current platform mapping:
- Sales Representative -> `company_operator`
- Sales Manager -> `ops_manager`
- Operations -> `ops_manager`
- Executive -> `analyst` (read/audit posture)
- Administrator -> `platform_admin`

## Authorization Boundary Rules
- All order APIs require explicit permission checks.
- Organization scope is mandatory.
- Site scope is enforced where applicable.
- Out-of-scope records return not found behavior for bounded visibility.

## Verified Behaviors
- Viewer denied create and audit operations.
- Authorized roles can create from quote, revise, approve, release, and cancel according to lifecycle constraints.
