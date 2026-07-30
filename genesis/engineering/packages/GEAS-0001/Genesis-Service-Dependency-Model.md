# Genesis Service Dependency Model

## Dependency Principles
1. Services may depend on other services.
2. Services SHALL NOT depend on applications.
3. Dependency cycles are prohibited.
4. Applications may depend on services.

## Service Dependency Graph
- Enterprise Registry Service -> Identity Service
- Configuration Service -> Identity Service
- Secrets Service -> Identity Service
- Workflow Service -> Identity Service
- Workflow Service -> Messaging Service
- Messaging Service -> Identity Service
- Notification Service -> Identity Service
- Notification Service -> Messaging Service
- Search Service -> Identity Service
- Search Service -> Messaging Service
- Media Service -> Identity Service
- Document Service -> Identity Service
- Document Service -> Media Service
- AI Service -> Identity Service
- AI Service -> Configuration Service
- Observability Service -> Identity Service
- Health Service -> Identity Service
- Health Service -> Observability Service
- Telemetry Service -> Identity Service
- Telemetry Service -> Observability Service
- Integration Service -> Identity Service
- Integration Service -> Secrets Service
- Integration Service -> Messaging Service
- Scheduler Service -> Identity Service
- Scheduler Service -> Workflow Service
- Feature Service -> Identity Service
- Feature Service -> Enterprise Registry Service

## Acyclicity Statement
The dependency graph is acyclic when ordered from foundational trust services to orchestration and specialized services.
