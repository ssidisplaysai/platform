# Genesis Service Boundary Model

## Boundary Principles
1. Applications own business capability.
2. Enterprise services own reusable platform capability.
3. Runtime owns execution.
4. Business Genome owns enterprise knowledge.
5. Services are application independent and reusable.

## Boundary Statements
| Domain Boundary | Owns | Must Not Own |
|---|---|---|
| Applications | Business domain capabilities and transactional workflows | Shared platform services |
| Enterprise Services | Reusable platform capabilities and service contracts | Business-domain authority records |
| Runtime | Execution, scheduling infrastructure, and operational execution mechanics | Business-domain and service-domain ownership decisions |
| Business Genome | Canonical enterprise knowledge and ontology | Generic platform service behavior |

## Service Independence Rules
- Services SHALL NOT depend on application persistence.
- Services SHALL NOT embed application-specific ownership logic.
- Services SHALL publish reusable contracts for multi-application consumption.

## Duplicate-Behavior Prohibition
Applications SHALL NOT reimplement enterprise service capability when a cataloged enterprise service exists.
