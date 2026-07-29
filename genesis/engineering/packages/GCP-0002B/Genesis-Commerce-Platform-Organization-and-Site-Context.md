# Genesis Commerce Platform Organization and Site Context

## Context Foundation
The application shell now establishes deterministic workspace context for organization and site selection.

## Organization Context
Source: CompanyRepository.getAll()

Mapped fields:
1. id
2. slug
3. name

## Site Context
Site context is generated as bounded foundation data:
1. id: organization-id + primary-site
2. slug: organization-slug + main
3. organizationId
4. name: organization name + Primary
5. region: US-CENTRAL

## Selection Rules
1. Default selected organization is first organization from repository order
2. Default selected site is first site matching selected organization
3. Changing organization automatically resets selected site to organization-compatible site

## Boundary Constraint
This foundation does not claim canonical authority for tenancy models. It is an application-level context adapter for UX composition only.

## Future Compatibility
The context contract is typed and can be replaced by authenticated tenant/profile APIs without changing shell consumers.
