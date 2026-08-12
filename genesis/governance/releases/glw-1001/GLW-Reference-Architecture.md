# GLW Reference Architecture (GLW-1001)

## Canonical Integration Pattern
GLW acts as the enterprise application implementation while platform responsibilities are externalized.

```mermaid
flowchart TD
  GLW[GLW Business Application]\nBusiness APIs + Workflows + Persistence
  EAR[EAR-1001A\nEnterprise Application Registry]
  EHC[EHC-1001A\nEnterprise Health Platform]
  GMC[GMC-1001C\nMission Control]

  GLW -->|Registration Metadata| EAR
  EAR -->|Application Inventory| EHC
  EHC -->|Health + Compatibility| GMC
  EAR -->|Discovery + Capabilities| GMC
  GMC -->|Launch Policy + Navigation| GLW
```

## Responsibility Model
### GLW owns
- Business logic
- Business workflows
- Business persistence
- Business APIs

### Genesis platform owns
- Registration authority (EAR)
- Health and compatibility authority (EHC)
- Discovery/navigation/launch orchestration (GMC)

## Integration Interfaces
1. EAR metadata registration consumed by EHC and GMC.
2. EHC health records consumed by GMC for launch gating and dashboards.
3. GMC launch policy resolves safe launch target and blocked states.
4. GLW route adapters expose app-specific health/capability through EHC-owned logic.

## Reference Invariants
1. No duplicate registry exists in GLW.
2. No enterprise health computation is implemented in GLW.
3. No launch-policy logic is implemented in GLW.
4. No system-of-record authority is moved from EAR/EHC/GMC into GLW.
