# Genesis Commerce Platform Multi-Site Architecture

## Objective
Provide a single platform that can operate multiple tenant brands and websites with strict isolation of configuration, profile, and credential references.

## Initial and Future Tenants
- LEDDisplayWarehouse.com (initial production tenant)
- SSIDisplays.com
- DigitalSphere.us
- ProjectionSphere.com
- VideoLEDWalls.com
- ProjectorEnclosure.com
- RJ Metal
- STONER

## Multi-Site Design Principles
- Shared application runtime and codebase
- Tenant-isolated operational records
- Site-isolated publishing and SEO profiles
- Strict credential indirection by reference, never raw secret persistence in site records
- Environment-aware controls for preview and live states

## Site Registry Model
Each site record should define:
- Site identity
- Brand identity
- Domain
- WordPress connection reference
- Publishing profile reference
- SEO profile reference
- Prompt profile reference
- Image profile reference
- Workflow profile reference
- Health status
- Environment
- Publishing state

## Credential Handling
- Application records store only credential references
- Secret material is resolved through Genesis-managed services
- Secret rotation and revocation are externalized from application data tables

## Multi-Tenant Isolation Controls
- Tenant-bound access controls
- Site-bound workflow execution constraints
- Tenant and site scoped audit trails
- No cross-tenant default inheritance without explicit governance approval

## Tenant Onboarding Path
1. Create organization
2. Register site identity and domain
3. Attach profile references
4. Validate publishing and health endpoints
5. Enable environment mode and publishing state

## Risks And Mitigations
1. Risk: accidental cross-tenant publishing
- Mitigation: tenant and site scoped publishing policy checks before execution.

2. Risk: profile drift between sites
- Mitigation: versioned profile references and compatibility checks.

3. Risk: credential reference misconfiguration
- Mitigation: preflight credential resolution validation and explicit error telemetry.

## Validation Outcome
The multi-site architecture preserves tenant isolation while keeping platform-level reuse and governance consistency.

## GCP-0002C Implementation Delta
1. Multi-site list, detail, health, and bounded creation routes are implemented.
2. Site configuration model is now explicit and typed in application foundation contracts.
3. Deterministic readiness and publishing guard logic is implemented with explainable blocking conditions.
4. Secondary Test Site is represented as disabled/not-configured and cannot publish.
5. No runtime publication, credential resolution, or workflow execution authority was introduced.

## GCP-0002D Integration Delta
1. Product records now include explicit site assignments scoped to site identifiers.
2. Product readiness checks now consume site enabled/publishability state as bounded dependencies.
3. Product catalog routes do not mutate site runtime authority and preserve site governance boundaries.
