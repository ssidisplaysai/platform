# Genesis Architecture Library

Status: Approved
Classification: Genesis Standard
Type: Reference Architecture Library

## Purpose

The architecture library defines the canonical conceptual architecture of Genesis.
It unifies constitutional doctrine, research programs, semantic standards, compiler stages, and runtime context into one coherent model.

This library explains system structure and knowledge flow.
It does not directly change implementation behavior.

Primary entry points:
- [ARCHITECTURE_MANIFEST.md](ARCHITECTURE_MANIFEST.md)
- [STATUS.md](../../STATUS.md)
- [GRT-0010-Genesis-Runtime-Baseline.md](grt-0010/GRT-0010-Genesis-Runtime-Baseline.md)
- [GMK-1003-Marketing-Kernel-Integration-Architecture.md](gmk-1003/GMK-1003-Marketing-Kernel-Integration-Architecture.md)
- [GMK-I001 Package Manifest](../engineering/packages/GMK-I001/00-package-manifest.md)
- [GMK-I002 Package Manifest](../engineering/packages/GMK-I002/00-package-manifest.md)
- [GMK-I004 Package Manifest](../engineering/packages/GMK-I004/00-package-manifest.md)
- [GMK-I005 Package Manifest](../engineering/packages/GMK-I005/00-package-manifest.md)
- [GMK-I006 Package Manifest](../engineering/packages/GMK-I006/00-package-manifest.md)
- [GMK-I007 Package Manifest](../engineering/packages/GMK-I007/00-package-manifest.md)
- [GMK-I007A Certification Manifest](../engineering/packages/GMK-I007A/00-package-manifest.md)
- [GBG-0001 Package Manifest](../engineering/packages/GBG-0001/00-package-manifest.md)
- [GBG-0001A Certification Manifest](../engineering/packages/GBG-0001A/00-package-manifest.md)
- [GBG-0002 Package Manifest](../engineering/packages/GBG-0002/00-package-manifest.md)
- [GBG-0002A Certification Manifest](../engineering/packages/GBG-0002A/00-package-manifest.md)
- [GBG-0002A Constitutional Freeze Record](../engineering/packages/GBG-0002A/GBG-0002A-Constitutional-Freeze-Record.md)
- [GBG-0003 Package Manifest](../engineering/packages/GBG-0003/00-package-manifest.md)
- [GBG-0003A Certification Manifest](../engineering/packages/GBG-0003A/00-package-manifest.md)
- [GBG-0003B Remediation Manifest](../engineering/packages/GBG-0003B/00-package-manifest.md)
- [GBG-0003C Recertification Manifest](../engineering/packages/GBG-0003C/00-package-manifest.md)
- [GBG-0003D Remediation Manifest](../engineering/packages/GBG-0003D/00-package-manifest.md)
- [GBG-0003E Final Recertification Manifest](../engineering/packages/GBG-0003E/00-package-manifest.md)
- [GBG-0003E Release Certificate](../engineering/packages/GBG-0003E/32-release-certificate.md)
- [GBG-0003F Remediation Manifest](../engineering/packages/GBG-0003F/00-package-manifest.md)
- [GBG-0003F Final Remediation Report](../engineering/packages/GBG-0003F/24-final-remediation-report.md)
- [GBG-0003G Final Recertification Manifest](../engineering/packages/GBG-0003G/00-package-manifest.md)
- [GBG-0003G Final Recertification Report](../engineering/packages/GBG-0003G/35-final-recertification-report.md)
- [GBG-0003G Release Certificate](../engineering/packages/GBG-0003G/37-release-certificate.md)
- [GBG-0003H Remediation Manifest](../engineering/packages/GBG-0003H/00-package-manifest.md)
- [GBG-0003H Final Validation Report](../engineering/packages/GBG-0003H/28-final-validation-report.md)
- [GBG-0003H Final Remediation Report](../engineering/packages/GBG-0003H/30-final-remediation-report.md)
- [GBGF-0001 Foundation Manifest](../engineering/packages/GBGF-0001/00-package-manifest.md)
- [GBGF-0001 Release Readiness](../engineering/packages/GBGF-0001/13-release-readiness.md)
- [GBGF-0001 Foundation Summary](../engineering/packages/GBGF-0001/17-foundation-summary.md)
- [GBGF-0001A Completion Manifest](../engineering/packages/GBGF-0001A/00-completion-manifest.md)
- [GBGF-0001A Foundation Completion Report](../engineering/packages/GBGF-0001A/01-foundation-completion-report.md)
- [GBGF-0001A Final Architecture Readiness](../engineering/packages/GBGF-0001A/13-final-architecture-readiness.md)
- [GCDM-0001 Package Manifest](../engineering/packages/GCDM-0001/00-package-manifest.md)
- [GCDM-0001 Canonical Data Model Charter](../engineering/packages/GCDM-0001/02-canonical-data-model-charter.md)
- [GCDM-0001 Final Architecture Report](../engineering/packages/GCDM-0001/23-final-architecture-report.md)
- [GCDM-0001A Completion Manifest](../engineering/packages/GCDM-0001A/00-completion-manifest.md)
- [GCDM-0001A Architecture Completion Report](../engineering/packages/GCDM-0001A/01-architecture-completion-report.md)
- [GCDM-0001A Final Architecture Readiness](../engineering/packages/GCDM-0001A/18-final-architecture-readiness.md)
- [GARR-0001 Review Manifest](../engineering/packages/GARR-0001/00-package-manifest.md)
- [GARR-0001 Finding Register](../engineering/packages/GARR-0001/16-finding-register.md)
- [GARR-0001 Final Readiness Report](../engineering/packages/GARR-0001/19-final-readiness-report.md)
- [GARR-0001A Remediation Manifest](../engineering/packages/GARR-0001A/00-package-manifest.md)
- [GARR-0001A Remediation Completion Report](../engineering/packages/GARR-0001A/16-remediation-completion-report.md)
- [GARR-0001A Readiness Revalidation Handoff](../engineering/packages/GARR-0001A/17-readiness-revalidation-handoff.md)
- [GARR-0001B Revalidation Manifest](../engineering/packages/GARR-0001B/00-package-manifest.md)
- [GARR-0001B Final Readiness Report](../engineering/packages/GARR-0001B/10-final-readiness-report.md)
- [GBG-0003A Release Certificate](../engineering/packages/GBG-0003A/GBG-0003A-Release-Certificate.md)
- [GKF-PKG-0001 Package Manifest](../engineering/packages/GKF-PKG-0001/00-package-manifest.md)
- [GKF-PKG-0001A Package Manifest](../engineering/packages/GKF-PKG-0001A/00-package-manifest.md)
- [GKF-PKG-0001B Constitutional Freeze Record](../engineering/packages/GKF-PKG-0001B/GKF-PKG-0001B-Constitutional-Freeze-Record.md)

## Distinction from Other Genesis Assets

Constitution:
- defines foundational doctrine and first principles
- answers what is true and what must constrain the platform

Research:
- explores hypotheses and collects evidence
- answers what may become true after validation

Semantics:
- defines canonical meaning and derivation rules
- answers what concepts and relationships are allowed and stable

Compiler Specifications:
- define stage-level transformation constraints and validation expectations
- answer how evidence-grounded knowledge is transformed deterministically

Engineering Documentation:
- explains implementation status, procedures, and operational guidance
- answers how the current system is built and operated

Implementation:
- source code and runtime behavior
- executes approved specifications but is not the authority for architectural meaning

## Role of the Architecture Library

The architecture library:
- provides the canonical system map across layers
- clarifies responsibilities, dependencies, and trust boundaries
- defines reference flow from reality to execution and back
- establishes a shared conceptual vocabulary for future standards and implementations

## Boundary Statement

This architecture library is specification and model only.
No compiler behavior, runtime behavior, or code-generation behavior is modified by these documents.
