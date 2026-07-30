# Genesis Commerce Platform Integration Profile Permissions

## Permission Surface
1. profiles:read
2. profiles:create
3. profiles:update
4. profiles:validate
5. profiles:evaluate_readiness
6. profiles:assign

## Enforcement Model
1. Server-side API authorization is required for profile writes and validation/readiness endpoints.
2. Navigation and command surfaces require profiles:read.
3. Viewer role has no profile write or evaluation permissions.
