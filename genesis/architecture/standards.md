# Architecture Standards

## Layer Responsibilities

- Presentation: UI and user interaction
- Modules: business application surfaces
- Services: business logic and orchestration
- Repositories: persistence access
- Runtime: platform lifecycle and orchestration
- Domain: business entities and rules
- Infrastructure: external integrations and adapters

## Standards

- Prefer composition over inheritance.
- Keep interfaces small and explicit.
- Avoid duplication by using shared abstractions.
- Build for long-term evolution and maintainability.
