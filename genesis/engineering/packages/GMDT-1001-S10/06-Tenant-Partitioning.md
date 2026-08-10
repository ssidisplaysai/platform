# 06 Tenant Partitioning

Partitioning model:
- manifest file contains deterministic tenant list
- one tenant file per tenant partition under tenants/
- file name derived deterministically from hex-encoded tenant id
- payload tenantId must equal partition identity

Guarantees:
- tenant mismatch fails closed
- one tenant cannot be read through another tenant partition payload
- tenant ordering is deterministic
