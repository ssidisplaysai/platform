# 07 Service Registry

Registered runtime-level mechanical service tokens:
- manufacturing.runtime
- manufacturing.runtime.dependencies
- manufacturing.runtime-metadata
- manufacturing.platform-identifier
- manufacturing.provider.clock
- manufacturing.provider.identifier
- manufacturing.provider.tenant-context
- manufacturing.provider.runtime-metadata
- manufacturing.provider.audit
- manufacturing.provider.observation
- manufacturing.provider.correlation
- manufacturing.integration.product-port
- manufacturing.integration.inventory-port
- manufacturing.integration.external-reference-validator.*

Service constraints:
- Duplicate registration rejects.
- No runtime registration of manufacturing business services.
