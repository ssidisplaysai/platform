# Genesis Enterprise Service Catalog

## Shared Enterprise Service Principle
Shared services are independent platform capabilities. They are consumed by applications and do not own application business authority.

## Shared Service Catalog
| Service | Purpose | Ownership Model |
|---|---|---|
| Authentication | Identity verification and token issuance | Shared service under Identity governance |
| Authorization | Permission decisioning and policy evaluation | Shared service under Identity governance |
| Artifact Registry | Immutable artifact registration and lookup | Shared governance service |
| Audit | Cross-application audit stream | Shared governance service |
| Notifications | Enterprise alert and communication routing | Shared service |
| Scheduling | Time-based job orchestration | Shared platform service |
| Workflow Runtime | Durable workflow execution engine | Shared platform service |
| Messaging | Event and async message transport | Shared platform service |
| Search | Federated enterprise search abstraction | Shared platform service |
| Document Services | Shared document rendering/packaging services | Shared platform service |
| Media Services | Asset storage/transformation services | Shared platform service |
| AI Services | Model invocation and tooling interfaces | Shared platform service |
| Configuration | Centralized config lifecycle and rollout | Shared platform service |
| Secrets | Secret storage and retrieval | Shared security service |
| Observability | Metrics, tracing, and diagnostics collection | Shared operations service |
| Telemetry | Business and system telemetry aggregation | Shared operations service |
| Logging | Structured log transport and retention | Shared operations service |
| Health Monitoring | Liveness/readiness and SLO status evaluation | Shared operations service |

## Service Independence Rule
No domain application may redefine these shared service responsibilities.
