# GLW Registration Documentation

## Registration Authority
EAR-1001A certified Enterprise Application Registry.

## GLW Registration Fields
- applicationId: glw
- code: GLW
- displayName: Green LED Warehouse
- description: Green LED Warehouse enterprise operations application integrated with certified Genesis platform services.
- ownerOrganization: Green LED Warehouse
- ownerTeam: GLW Platform Team
- technicalContact: platform@greenledwarehouse.local
- lifecycleState: ACTIVE
- launchPath: /glw
- capabilities: catalog, order-management, page-generation
- healthEndpoint: /api/glw/health
- capabilityEndpoint: /api/glw/capabilities
- contractVersion: 1.0.0

## Evidence
- src/platform/ear/seed.ts
- tests/glw/genesis-platform-integration.test.ts
