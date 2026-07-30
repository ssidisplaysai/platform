# Genesis Service Responsibility Matrix

## Responsibility Matrix
| Capability | Authoritative Service Owner | Primary Consumers |
|---|---|---|
| Authentication | Identity Service | All applications and services |
| Authorization | Identity Service | All applications and services |
| Organizations | Identity Service | Enterprise applications |
| Users | Identity Service | Enterprise applications |
| Roles | Identity Service | Enterprise applications |
| Permissions | Identity Service | Enterprise applications |
| Sessions | Identity Service | Enterprise applications |
| Application Registry | Enterprise Registry Service | Runtime, Governance, Operations |
| Service Registry | Enterprise Registry Service | Runtime, Governance, Operations |
| Artifact Registry | Enterprise Registry Service | Build, Delivery, Governance |
| Package Registry | Enterprise Registry Service | Governance, Delivery |
| Extension Registry | Enterprise Registry Service | Developer Platform, Runtime |
| Environment Configuration | Configuration Service | Runtime, Applications |
| Application Configuration | Configuration Service | Applications |
| Feature Flags | Configuration Service | Applications, Runtime |
| Runtime Configuration | Configuration Service | Runtime |
| Secret References | Configuration Service | Applications, Runtime |
| Credential Storage | Secrets Service | Runtime, Integration Service |
| Key Management | Secrets Service | Runtime, Integration Service |
| Rotation Contracts | Secrets Service | Security, Runtime |
| Audit Logging | Secrets Service | Audit, Security |
| Workflow Execution | Workflow Service | Applications, Runtime |
| Scheduling | Workflow Service | Applications, Runtime |
| Triggers | Workflow Service | Applications |
| Background Execution | Workflow Service | Applications, Runtime |
| Events | Messaging Service | Services, Applications |
| Queues | Messaging Service | Services, Applications |
| Topics | Messaging Service | Services, Applications |
| Subscriptions | Messaging Service | Services, Applications |
| Delivery Guarantees | Messaging Service | Services, Applications |
| Email | Notification Service | Applications |
| SMS | Notification Service | Applications |
| Push | Notification Service | Applications |
| In-App Notifications | Notification Service | Applications |
| Delivery Tracking | Notification Service | Applications, Operations |
| Enterprise Search | Search Service | Applications |
| Index Contracts | Search Service | Applications, Services |
| Query Contracts | Search Service | Applications, Services |
| Ranking | Search Service | Applications |
| File Storage | Media Service | Applications |
| Media Lifecycle | Media Service | Applications |
| Metadata | Media Service | Applications |
| Asset Management | Media Service | Applications |
| Thumbnail Contracts | Media Service | Applications |
| Document Rendering | Document Service | Applications |
| PDF | Document Service | Applications |
| HTML | Document Service | Applications |
| Templates | Document Service | Applications |
| Printing | Document Service | Applications |
| Versioning | Document Service | Applications |
| Model Abstraction | AI Service | Applications, Services |
| Prompt Orchestration | AI Service | Applications, Services |
| Provider Routing | AI Service | Applications, Services |
| Cost Tracking | AI Service | Operations, Finance |
| Response Validation | AI Service | Applications, Services |
| Logging | Observability Service | Applications, Services, Runtime |
| Metrics | Observability Service | Applications, Services, Runtime |
| Tracing | Observability Service | Applications, Services, Runtime |
| Diagnostics | Observability Service | Applications, Services, Runtime |
| Health Endpoints | Health Service | Operations |
| Dependency Monitoring | Health Service | Operations |
| Availability | Health Service | Operations |
| Recovery Recommendations | Health Service | Operations |
| Usage Metrics | Telemetry Service | Operations, Analytics |
| Performance Metrics | Telemetry Service | Operations, Analytics |
| Capacity Metrics | Telemetry Service | Operations, Analytics |
| Analytics Events | Telemetry Service | Operations, Analytics |
| External Systems | Integration Service | Applications |
| Connector Registration | Integration Service | Applications |
| API Contracts | Integration Service | Applications, Services |
| Sync Orchestration | Integration Service | Applications, Services |
| Timers | Scheduler Service | Services, Applications |
| Recurring Jobs | Scheduler Service | Services, Applications |
| Execution Windows | Scheduler Service | Services, Applications |
| Retry Policies | Scheduler Service | Services, Applications |
| Capability Registration | Feature Service | Applications, Services |
| Feature Enablement | Feature Service | Applications, Runtime |
| Capability Discovery | Feature Service | Applications, Services |

## Deterministic Ownership Rule
Each reusable capability above has exactly one authoritative service owner.
