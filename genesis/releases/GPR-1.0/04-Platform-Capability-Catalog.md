# Platform Capability Catalog - GPR-1.0

## Capability Inventory

| Capability | Purpose | Owner | Authoritative Package | Dependencies | Consumers | Current Status | Future Evolution |
|---|---|---|---|---|---|---|---|
| Governance | Constitutional authority, standards, release controls | Governance Council | GCF/GCD artifacts | None | All services and applications | Certified | Expanded policy automation |
| Registry | Application identity and metadata authority | Platform Registry | EAR-1001A | GCF/GCD | EHC, GMC, applications | Certified | Multi-tenant metadata extensions |
| Enterprise Health | Health/readiness/liveness/compatibility aggregation | Platform Health | EHC-1001A | EAR-1001A | GMC, governance reports | Certified | Advanced diagnostics and SLO models |
| Mission Control | Discovery, search, dashboard, navigation, launch policy | Platform Orchestration | GMC-1001D | EAR-1001A, EHC-1001A | Enterprise users, integrated apps | Certified | Workspace federation and role-aware orchestration |
| Application Integration | Canonical onboarding and boundary pattern | Integration Program | GLW-1001B baseline pattern | EAR, EHC, GMC | Future enterprise apps | Certified | SSI/STONER/manufacturing/finance profiles |
| Artifact Lifecycle | Certification/evidence lifecycle management | Governance Operations | Governance release packages | Governance model | Engineering and audit functions | Active | Automated lifecycle controls |
| Metadata Engine | Metadata as source for discovery and orchestration | Registry + Orchestration | EAR + GMC | Constitution | EHC, GMC, apps | Active | Rich taxonomy and lineage controls |
| Workflow Engine | Structured certification and release flow | Governance Program | Release work orders | Governance principles | Program management | Active | End-to-end release automation |
| Messaging | Platform event signaling surfaces (governed, constrained) | Platform Runtime | Runtime and app layers | Architecture constraints | Apps and operations | Emerging | Certified event-contract layer |
| Runtime | Deterministic platform/service composition | Platform Engineering | Platform runtimes | Constitutional boundaries | API and orchestration layers | Active | Hardened production runtime baseline |
| Marketing Kernel | Domain-specific capability framework | Business Application Layer | Marketing workstreams | Platform integration pattern | Marketing applications | Emerging | Certified kernel service packages |
| Business Genome | Enterprise knowledge and object model framework | Knowledge Program | Genome governance packages | Governance + platform | Agents, analytics, intelligence | Emerging | Full graph-backed intelligence services |
| Validation | Test, regression, and evidence validation | Quality Engineering | Jest suites + evidence docs | Platform services | Certification processes | Active | Continuous compliance scoring |
| Certification | Formal decision and status publication | Certification Review Authority | Release decision artifacts | Validation + governance | Executives, engineering, audit | Active | Unified machine-readable certification registry |
| Dependency Analysis | Dependency chain and cycle assurance | Architecture Assurance | Dependency review artifacts | Source graph + tsconfig | Certification and release gating | Active | Full-repo dependency graph automation |
