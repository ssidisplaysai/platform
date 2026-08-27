# Genesis Institutional Corpus Recovery State

## Recovery Purpose

This recovery preserves original Genesis institutional documentation that existed only as uncommitted working-tree material. Recovery was necessary to protect the original bytes from loss without mixing them with unrelated engineering, runtime, certification, UI, or governance changes in the source worktree.

## Source Identity

- Source worktree: `C:\Users\rober\Documents\Stoner Platform\platform-gmp-0008a`
- Source repository common directory: `C:\Users\rober\Documents\Stoner Platform\platform\.git`
- Source branch: `implementation/gci-p1-0002-evidence-runtime-foundation`
- Source HEAD: `7921360aefe55c57f438b186bd440027d2ae7bb1`
- Corpus classification: untracked and uncommitted institutional working-tree material

## Destination Identity

- Destination repository common directory: `C:\Users\rober\Documents\Stoner Platform\platform\.git`
- Destination baseline: `8abf488fdb74d026755e1c766aee446837eb3a59`
- Recovery branch: `recovery/genesis-institutional-corpus-20260810`
- Recovery worktree: `C:\Users\rober\Documents\Stoner Platform\worktrees\genesis-institutional-corpus-20260810`
- Recovery date: `2026-08-27`

## Recovery Boundary

- Exactly 43 source corpus files were copied through an explicit allowlist.
- Source and destination SHA-256 values are recorded in `RECOVERY-MANIFEST.sha256`.
- Original paths, bytes, wording, formatting, and lifecycle states were preserved.
- No lifecycle state was reinterpreted, promoted, downgraded, certified, frozen, or published by this recovery.
- Historical uses of terms such as publication, baseline, certification, frozen, or archived describe the recovered documents; they do not imply that the files previously had durable Git history.

## Intentional Exclusions

The nine ambiguous GUX/GPO files were intentionally excluded:

1. `genesis/engineering/packages/GUX-0001/Genesis-User-Experience-Architecture.md`
2. `genesis/engineering/packages/GUX-0001/LIFECYCLE-METADATA.md`
3. `genesis/engineering/packages/GUX-0001/README.md`
4. `genesis/engineering/packages/GPO-0001/Genesis-Product-Portfolio.md`
5. `genesis/engineering/packages/GPO-0001/LIFECYCLE-METADATA.md`
6. `genesis/engineering/packages/GPO-0001/README.md`
7. `genesis/engineering/packages/GPO-0002/Genesis-Product-Execution-Roadmap.md`
8. `genesis/engineering/packages/GPO-0002/LIFECYCLE-METADATA.md`
9. `genesis/engineering/packages/GPO-0002/README.md`

GMX-0001 was intentionally excluded and remains suspended in its existing worktree.

## Documentation Index Evidence

The destination root `DOCUMENTATION_INDEX.md` was intentionally not modified. The source working copy and exact Git-generated diff are preserved here as historical recovery evidence only:

- `DOCUMENTATION_INDEX.source-working-copy.md`
- `DOCUMENTATION_INDEX.institutional.diff`

These files record what the original sessions created. They are not current registry authority and do not establish future institutional discoverability governance.

## Phase Boundary

Phase 1 stops after recovery and validation. No recovered file is staged or committed. No push or merge is authorized.

## Complete Source Status Snapshot

The pre-recovery and post-recovery source status snapshots are byte-identical under the recorded UTF-8 status fingerprint. The complete 231-entry porcelain snapshot follows:

 M DOCUMENTATION_INDEX.md
 M genesis/compiler/README.md
 M genesis/engineering/packages/GCI-P1-0002/LIFECYCLE-METADATA.md
 M genesis/engineering/packages/GEAI-0001/Genesis-Constitutional-Package-Catalog.md
 M genesis/engineering/packages/GPO-0001/LIFECYCLE-METADATA.md
 M genesis/engineering/packages/GPO-0001/README.md
 M genesis/engineering/packages/GPO-0002/LIFECYCLE-METADATA.md
 M genesis/roadmap/milestones.md
 M package-lock.json
 M package.json
 M src/app/globals.css
 M src/app/page.tsx
 M src/compiler/index.ts
 M src/compiler/runtime/index.ts
?? genesis/architecture/GEA-0001-Genesis-Enterprise-Architecture-Standard-v1.0-Part-I.md
?? genesis/architecture/GEA-0001A-Genesis-Enterprise-Canon-v1.0.md
?? genesis/ceo-office/CEO-1001/CEO-1001-Genesis-1.0-Product-Definition.md
?? genesis/ceo-office/CEO-1001/LIFECYCLE-METADATA.md
?? genesis/ceo-office/CEO-1001/README.md
?? genesis/engineering/packages/GAD-0001/GAD-0001-Genesis-Architecture-Dashboard-Specification.md
?? genesis/engineering/packages/GAD-0001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GAP-0001/GAP-0001-Genesis-Architecture-Portal-Product-Definition.md
?? genesis/engineering/packages/GAP-0001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCD-0004/GCD-0004-Transition-to-the-Enterprise-Expansion-Era.md
?? genesis/engineering/packages/GCD-0004/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCI-0001/GCI-0001-Genesis-Compiler-Implementation-Program.md
?? genesis/engineering/packages/GCI-0001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCI-0001/README.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Allowed-Dependencies.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Architecture-Boundaries.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Authorization-Decision.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Authorization-Scope.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Canonical-Entity-Rules.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Certification-Requirements.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Engineering-Deliverables.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Entity-Runtime-Responsibilities.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Forbidden-Dependencies.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Governance-Gates.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Identity-Resolution-Boundaries.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Implementation-Rules.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/README.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Required-Evidence.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Required-Test-Matrix.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Risk-Assessment.md
?? genesis/engineering/packages/GCI-AUTH-P2-0002/Stop-Conditions.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Allowed-Dependencies.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Architecture-Boundaries.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Authorization-Decision.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Authorization-Scope.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Canonical-Business-Rule-Rules.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Certification-Requirements.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Engineering-Deliverables.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Forbidden-Dependencies.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Governance-Gates.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Implementation-Rules.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/README.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Required-Evidence.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Required-Test-Matrix.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Risk-Assessment.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Rule-Evaluation-Boundaries.md
?? genesis/engineering/packages/GCI-AUTH-P2-0004/Stop-Conditions.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Allowed-Dependencies.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Architecture-Boundaries.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Authorization-Decision.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Authorization-Scope.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Business-Genome-Assembly-Boundaries.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Canonical-Business-Genome-Rules.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Certification-Requirements.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Engineering-Deliverables.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Forbidden-Dependencies.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Governance-Gates.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Implementation-Rules.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/README.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Required-Evidence.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Required-Test-Matrix.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Risk-Assessment.md
?? genesis/engineering/packages/GCI-AUTH-P2-0005/Stop-Conditions.md
?? genesis/engineering/packages/GCI-P1-0002/GCI-P1-0002-Freeze-Report.md
?? genesis/engineering/packages/GCI-P1-0002A/Evidence-Validation-Runtime-Precontract.md
?? genesis/engineering/packages/GCI-P1-0002A/IBR-Runtime-Precontract.md
?? genesis/engineering/packages/GCI-P1-0002A/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCI-P1-0002A/Manifest-Runtime-Precontract.md
?? genesis/engineering/packages/GCI-P1-0002A/Phase-Traceability-Matrix.md
?? genesis/engineering/packages/GCI-P1-0002A/README.md
?? genesis/engineering/packages/GCI-P1-0002A/Replay-Runtime-Precontract.md
?? genesis/engineering/packages/GCI-P1-0002A/Runtime-Precontracts-Overview.md
?? genesis/engineering/packages/GCI-P1-0003/Architecture-Compliance-Report.md
?? genesis/engineering/packages/GCI-P1-0003/Certification-Evidence.md
?? genesis/engineering/packages/GCI-P1-0003/Coverage-Summary.md
?? genesis/engineering/packages/GCI-P1-0003/GCS-0001-Conformance-Report.md
?? genesis/engineering/packages/GCI-P1-0003/Implementation-Report.md
?? genesis/engineering/packages/GCI-P1-0003/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCI-P1-0003/README.md
?? genesis/engineering/packages/GCI-P1-0003/Test-Summary.md
?? genesis/engineering/packages/GCI-P2-0003/Architecture-Compliance-Report.md
?? genesis/engineering/packages/GCI-P2-0003/Certification-Evidence.md
?? genesis/engineering/packages/GCI-P2-0003/Coverage-Summary.md
?? genesis/engineering/packages/GCI-P2-0003/GCS-0001-Conformance-Report.md
?? genesis/engineering/packages/GCI-P2-0003/Implementation-Report.md
?? genesis/engineering/packages/GCI-P2-0003/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCI-P2-0003/README.md
?? genesis/engineering/packages/GCI-P2-0003/Test-Summary.md
?? genesis/engineering/packages/GCR-1.0/Genesis-Compiler-v1.0-Architecture-Report.md
?? genesis/engineering/packages/GCR-1.0/Genesis-Compiler-v1.0-Certification-Report.md
?? genesis/engineering/packages/GCR-1.0/Genesis-Compiler-v1.0-Dependency-Report.md
?? genesis/engineering/packages/GCR-1.0/Genesis-Compiler-v1.0-Determinism-Report.md
?? genesis/engineering/packages/GCR-1.0/Genesis-Compiler-v1.0-LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GCR-1.0/Genesis-Compiler-v1.0-Release-Manifest.md
?? genesis/engineering/packages/GCR-1.0/Genesis-Compiler-v1.0-Repository-Integrity-Report.md
?? genesis/engineering/packages/GKN-1001/GKN-1001-Blueprint-Engineering-Charter.md
?? genesis/engineering/packages/GKN-1001/GKN-1001-Constitutional-Inheritance-Review.md
?? genesis/engineering/packages/GKN-1001/GKN-1001-Platform-Design-Review.md
?? genesis/engineering/packages/GKN-1001/GKN-1001-Pre-Engineering-Gate-Decision.md
?? genesis/engineering/packages/GKN-1001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GKN-1001/README.md
?? genesis/engineering/packages/GPD-EXEC-0001/Genesis-Execution-Readiness-Declaration.md
?? genesis/engineering/packages/GPD-EXEC-0001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GPD-EXEC-0001/README.md
?? genesis/engineering/packages/GPL-0001/GPL-0001-Genesis-Pattern-Library-Framework.md
?? genesis/engineering/packages/GPL-0001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GPO-0001/Genesis-Product-Portfolio.md
?? genesis/engineering/packages/GPO-0002/Genesis-Product-Execution-Roadmap.md
?? genesis/engineering/packages/GPO-0002/README.md
?? genesis/engineering/packages/GPW-1001/GPW-1001-Genesis-Knowledge-Workspace-Vision.md
?? genesis/engineering/packages/GPW-1001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GPW-1001/README.md
?? genesis/engineering/packages/GPW-1002/GPW-1002-Genesis-Product-Workspace-Vision.md
?? genesis/engineering/packages/GPW-1002/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GPW-1002/README.md
?? genesis/engineering/packages/GPW-1003/GPW-1003-Genesis-Manufacturing-Workspace-Vision.md
?? genesis/engineering/packages/GPW-1003/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GPW-1003/README.md
?? genesis/engineering/packages/GSA-0001/GSA-0001-Genesis-Synchronization-Audit-Framework.md
?? genesis/engineering/packages/GSA-0001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GUX-0001/Genesis-User-Experience-Architecture.md
?? genesis/engineering/packages/GUX-0001/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/GUX-0001/README.md
?? genesis/engineering/packages/WS-II/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/WS-II/README.md
?? genesis/engineering/packages/WS-III/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/WS-III/README.md
?? genesis/engineering/packages/WS-IIIA-R1/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/WS-IIIA-R1/README.md
?? genesis/engineering/packages/WS-IIIA/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/WS-IIIA/README.md
?? genesis/engineering/packages/WS-IIIB/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/WS-IIIB/README.md
?? genesis/engineering/packages/WS-IIIC/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/WS-IIIC/README.md
?? genesis/engineering/packages/WS-IIID/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/WS-IIID/README.md
?? genesis/engineering/packages/WS-IIIE/LIFECYCLE-METADATA.md
?? genesis/engineering/packages/WS-IIIE/README.md
?? genesis/founder-office/Founder-Session-Closeout/2026-08-10/Founder-Session-Closeout-2026-08-10.md
?? genesis/founder-office/Founder-Session-Closeout/2026-08-10/LIFECYCLE-METADATA.md
?? genesis/founder-office/Founder-Session-Closeout/2026-08-10/README.md
?? genesis/founder-office/GSO-0001/DRAFT-HISTORY.md
?? genesis/founder-office/GSO-0001/GSO-0001-The-Genesis-Story.md
?? genesis/founder-office/GSO-0001/LIFECYCLE-METADATA.md
?? genesis/founder-office/GSO-0001/README.md
?? genesis/founder-office/Genesis-Founder-Journal/FJ-0001-The-Day-We-Discovered-the-Mission.md
?? genesis/founder-office/Genesis-Founder-Journal/FJ-0002-Technology-Extends-Human-Capability.md
?? genesis/founder-office/Genesis-Founder-Journal/FJ-0003-Systems-Create-Room-for-Dreams.md
?? genesis/founder-office/Genesis-Founder-Journal/FJ-0004-Genesis-Moment-Zero.md
?? genesis/founder-office/Genesis-Founder-Journal/FJ-0005-The-Founder-Genome.md
?? genesis/founder-office/Genesis-Founder-Journal/LIFECYCLE-METADATA.md
?? genesis/founder-office/Genesis-Founder-Journal/README.md
?? genesis/philosophy/GES-0001/GES-0001-Genesis-Executive-Workspace-Visual-Standard.md
?? genesis/philosophy/GES-0001/LIFECYCLE-METADATA.md
?? genesis/philosophy/GES-0001/README.md
?? genesis/philosophy/GPX-0001-Genesis-Cross-Workspace-Experience/Genesis-Cross-Workspace-Experience-v1.0.md
?? genesis/philosophy/GPX-0001-Genesis-Cross-Workspace-Experience/LIFECYCLE-METADATA.md
?? genesis/philosophy/GPX-0001-Genesis-Cross-Workspace-Experience/README.md
?? genesis/philosophy/GX-003-Executive-Decision-Validation/Executive-Decision-Validation-Plan.md
?? genesis/philosophy/GX-003-Executive-Decision-Validation/Findings-Template.md
?? genesis/philosophy/GX-003-Executive-Decision-Validation/Improvement-Log.md
?? genesis/philosophy/GX-003-Executive-Decision-Validation/Observer-Checklist.md
?? genesis/philosophy/GX-003-Executive-Decision-Validation/Participant-Questionnaire.md
?? genesis/philosophy/GX-003-Executive-Decision-Validation/Scenario-Scripts.md
?? genesis/philosophy/GX-003-Executive-Decision-Validation/TTU-Measurement-Sheet.md
?? genesis/philosophy/GX-004-Genesis-Workspace-Blueprint/Genesis-Workspace-Blueprint-v1.0.md
?? genesis/philosophy/GX-004-Genesis-Workspace-Blueprint/LIFECYCLE-METADATA.md
?? genesis/philosophy/GX-004-Genesis-Workspace-Blueprint/README.md
?? genesis/philosophy/The-Genesis-Experience-Manifesto.md
?? genesis/program-office/milestones/GCF-1.0/Certification-Summary.md
?? genesis/program-office/milestones/GCF-1.0/Compiler-Foundation-Summary.md
?? genesis/program-office/milestones/GCF-1.0/Genesis-Compiler-Foundation-Phase-1.md
?? genesis/program-office/milestones/GCF-1.0/Governance-Summary.md
?? genesis/program-office/milestones/GCF-1.0/Implementation-Baseline.md
?? genesis/program-office/milestones/GCF-1.0/LIFECYCLE-METADATA.md
?? genesis/program-office/milestones/GCF-1.0/README.md
?? genesis/program-office/milestones/GCF-1.0/Repository-Baseline.md
?? genesis/program-office/milestones/GCF-1.0/Roadmap-to-Phase-2.md
?? genesis/program-office/milestones/GMR-0001-First-Certified-Genesis-Product.md
?? genesis/roadmap/GASP-0001-Genesis-Architectural-Stewardship-Roadmap-v1.0.md
?? genesis/standards/GPS-0001-Genesis-Platform-Layer-Mapping-Standard.md
?? genesis/standards/GPS-0002-Genesis-Platform-Dependency-Standard.md
?? genesis/standards/GPS-0003-Genesis-Constitutional-Ownership-Standard.md
?? src/app/dashboard/page.tsx
?? src/app/executive-workspace/page.tsx
?? src/app/login/page.tsx
?? src/app/platforms/[id]/page.tsx
?? src/app/platforms/page.tsx
?? src/compiler/runtime/evidence-validation/EvidenceValidationRuntimeFactory.ts
?? src/compiler/runtime/evidence-validation/EvidenceValidationRuntimeRegistry.ts
?? src/compiler/runtime/evidence-validation/contracts.ts
?? src/compiler/runtime/evidence-validation/index.ts
?? src/compiler/runtime/relationship/RelationshipRuntimeFactory.ts
?? src/compiler/runtime/relationship/RelationshipRuntimeRegistry.ts
?? src/compiler/runtime/relationship/contracts.ts
?? src/compiler/runtime/relationship/index.ts
?? src/components/gap/portal-shell.tsx
?? src/components/gap/sidebar-nav.tsx
?? src/components/gap/status-bar.tsx
?? src/components/gap/top-bar.tsx
?? src/features/executive-prototype/executive-workspace-prototype.tsx
?? src/features/gap/config/navigation.ts
?? src/features/gap/context/gap-workspace-context.tsx
?? src/features/gap/data/platforms.ts
?? src/hooks/use-theme-mode.ts
?? src/lib/classnames.ts
?? src/services/gap-platform-service.ts
?? src/styles/gap-tokens.ts
?? src/types/gap.ts
?? tests/compiler/runtime/evidence-validation/evidence-validation-runtime-factory.test.ts
?? tests/compiler/runtime/evidence-validation/evidence-validation-runtime-registry-and-architecture.test.ts
?? tests/compiler/runtime/relationship/relationship-runtime-factory.test.ts
?? tests/compiler/runtime/relationship/relationship-runtime-registry-and-architecture.test.ts
