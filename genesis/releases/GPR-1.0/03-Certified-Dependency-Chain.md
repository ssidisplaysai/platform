# Certified Dependency Chain - GPR-1.0

## Chain Overview
Genesis Constitutional Foundation
-> Enterprise Application Registry
-> Enterprise Health Platform
-> Mission Control
-> Green LED Warehouse

## Node 1
Package: GCF-0001A
Version: 1.0.0
Certification Status: CERTIFIED
Authority: Constitutional Governance
Dependencies: none
Evidence References:
- genesis/governance/releases/gcf-0001a/Genesis-Constitutional-Certification-Closure-Report.md
Relationship to downstream:
- Establishes constitutional boundaries for all platform services

## Node 2
Package: EAR-1001A
Version: 1.0.0
Certification Status: CERTIFIED
Authority: GCD-0004
Dependencies:
- GCF-0001A
Evidence References:
- genesis/governance/releases/ear-1001a/Enterprise-Registry-Foundation-Certification-Decision.md
Relationship to downstream:
- Provides authoritative application identity and metadata to EHC and GMC

## Node 3
Package: EHC-1001A
Version: 1.0.0
Certification Status: CERTIFIED
Authority: GCD-0005
Dependencies:
- GCF-0001A
- EAR-1001A
Evidence References:
- genesis/governance/releases/ehc-1001a/Enterprise-Health-Platform-Certification-Decision.md
Relationship to downstream:
- Provides authoritative health and compatibility state to GMC

## Node 4
Package: GMC-1001D
Version: 1.0.0
Certification Status: CERTIFIED
Authority: GCD-0003
Dependencies:
- EAR-1001A
- EHC-1001A
Evidence References:
- genesis/governance/releases/gmc-1001d/Mission-Control-Final-Certification-Status.md
Relationship to downstream:
- Orchestrates enterprise discovery, navigation, search, and launch policy for applications

## Node 5
Package: GLW-1001B
Version: 1.0.0
Certification Status: CERTIFIED
Authority: Application Integration under certified platform chain
Dependencies:
- EAR-1001A
- EHC-1001A
- GMC-1001D
Evidence References:
- genesis/governance/releases/glw-1001b/GLW-Final-Genesis-Integration-Certification-Decision.md
Relationship to downstream:
- Serves as canonical certified application integration reference for future applications
