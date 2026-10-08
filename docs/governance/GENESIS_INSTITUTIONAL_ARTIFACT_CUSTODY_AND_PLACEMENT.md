# Genesis Institutional Artifact Custody and Placement

Status: ARCHITECTURE APPROVED WITH CONDITIONS; OTHER GOVERNANCE REVIEWS PENDING
Classification: Non-Constitutional Repository Governance Record
Scope: Institutional artifact custody, placement, and discoverability only

Architecture Decision: `ARD-0002`
Architecture Record: `ADR-0014`
Repository Implementation: NOT PUBLISHED; NOT INTEGRATED; NOT EFFECTIVE ON MAIN

## 1. Purpose

Define the minimum repository custody, placement, classification, and discoverability rules needed to preserve non-constitutional Genesis institutional artifacts without granting them authority they do not possess.

## 2. Scope

This record applies to non-constitutional experience, founder-intent, executive-intent, vision, historical, and recovery-provenance artifacts under `genesis/`. It does not approve artifact content, validate historical claims, authorize implementation, or amend constitutional governance.

## 3. Authority Boundary

This is a subordinate repository governance record. Architecture Review Board decision `ARD-0002` approved the architecture with conditions on 2026-08-27. Review by Genesis Documentation, Governance Operations, Engineering Leadership, and CODEOWNERS remains pending before publication or integration.

It does not possess or confer constitutional, architecture, engineering certification, runtime, production, security, release, or package certification authority.

Until those remaining reviews are complete and this candidate is integrated through the approved repository process, current `origin/main` governance and taxonomy remain authoritative. This candidate branch and the architecture decision alone do not activate any proposed institution, repository root, artifact class, lifecycle state, or GPW classification.

## 4. Canonical Custody vs Canonical Authority

Institutional integration establishes durable canonical custody of an artifact, but does not independently validate or promote the lifecycle claims contained within that artifact.

**Canonical Custody:** The repository is the durable source for preserved artifact bytes, provenance, and history.

**Canonical Authority:** The artifact is currently approved to govern downstream behavior under the applicable Genesis authority process.

Repository presence alone grants custody, not authority.

## 5. Historical Lifecycle Interpretation

Lifecycle labels preserved inside recovered artifacts are historical self-descriptions from their source context. Labels including `FROZEN`, `CERTIFIED EXPERIENCE STANDARD`, `FOUNDATIONAL BASELINE`, `PORTFOLIO EXPERIENCE BASELINE`, `VISION BASELINE`, `EXECUTIVE BASELINE`, `FOUNDER_WORKING_DRAFT`, `FROZEN PROCESS`, `ARCHIVED`, `MATURING`, `EXPLORING`, and `READY FOR WORKING PAPER` do not become currently effective Genesis authority through integration.

Current authority requires the separately applicable review or revalidation process. Historical artifacts remain byte-preserved and are not rewritten to express current disposition.

## 6. Non-Constitutional Institutional Functions

Genesis may maintain non-constitutional institutional functions for experience stewardship, founder intent, and executive intent. These functions own their source context and working records only. They may recommend promotion but may not perform constitutional or engineering promotion.

## 7. Genesis Experience Studio

Genesis Experience Studio is a non-constitutional product-experience function.

It may:

- develop experience principles and concepts;
- create and revise experience working definitions;
- conduct experience research and user or founder validation;
- steward workspace continuity, explainability, accessibility, trust, and human-capability experience principles;
- manage working-definition lifecycle states; and
- recommend promotion through the applicable authority process.

It may not:

- grant constitutional approval or engineering certification;
- authorize runtime, production, security, or releases;
- approve architecture;
- silently convert working definitions into standards; or
- retroactively certify historical artifacts.

## 8. Genesis Founder's Office

Genesis Founder's Office is a proposed non-constitutional founder-intent and historical function. Its proposed repository root, subject to approval of this record, is `genesis/founder-office/`.

It may preserve founder journals, founder-authored narratives, founder session closeouts, founder intent, Founder Genome source material, and founder-authored working papers. It may confirm whether an interpretation accurately represents founder intent.

It may not grant constitutional authority, engineering certification, architecture approval, production or release authority, or automatically promote founder belief into governing enterprise knowledge.

## 9. Genesis CEO Office

Genesis CEO Office is a proposed non-constitutional executive-intent function. Its proposed repository root, subject to approval of this record, is `genesis/ceo-office/`.

It may define executive product intent, record strategic product direction, establish executive intent baselines, record executive decisions and portfolio intent, and sponsor product or experience work.

It may not independently authorize engineering implementation; grant constitutional, architecture, certification, runtime, release, security, or production authority; or convert executive intent into an implementation mandate.

`EXECUTIVE BASELINE` means an executive intent baseline only.

## 10. Proposed Repository Roots

Subject to this record becoming effective, the non-constitutional placement model is:

| Root | Custody purpose |
|---|---|
| `genesis/philosophy/` | Discovery, philosophy, manifesto, experience validation, historical experience baseline, workspace blueprint, and cross-workspace experience artifacts |
| `genesis/experience-studio/` | Active non-constitutional experience working definitions |
| `genesis/founder-office/` | Founder-intent, journal, narrative, and historical session artifacts |
| `genesis/ceo-office/` | Executive-intent, product-definition, and strategic decision artifacts |
| `genesis/recovery/` | Non-authoritative recovery provenance |
| `genesis/engineering/packages/` | Existing governed package roots plus explicitly classified non-constitutional vision packages |

Directory existence does not establish institutional authority.

## 11. `genesis/philosophy` Artifact Classes

`genesis/philosophy/` may contain non-equivalent classes:

- discovery record;
- manifesto or philosophy artifact;
- experience validation artifact;
- historical experience standard or baseline;
- workspace blueprint; and
- cross-workspace experience architecture.

Placement there does not independently imply current canonical authority, approval, certification, freeze, or constitutional status.

## 12. `VISION_PACKAGE` Classification

`VISION_PACKAGE` is a non-constitutional, non-implementation package classification. It may exist as a physical directory under `genesis/engineering/packages/`, contain product or workspace vision material, and carry product-vision lifecycle labels.

It does not authorize engineering or runtime work and is excluded from constitutional package-root parity. `GPW-1001`, `GPW-1002`, and `GPW-1003` are prospectively classified as `VISION_PACKAGE` when integrated under canonical custody.

This classification is architecturally approved with the conditions in `ARD-0002` but does not become effective through its presence on the candidate branch. It becomes repository policy only after remaining required reviews and approved integration. Until then, current-main taxonomy remains authoritative and no GPW package has current canonical `VISION_PACKAGE` classification.

## 13. `EXPERIENCE_WORKING_DEFINITION` Classification

`EXPERIENCE_WORKING_DEFINITION` is non-constitutional, pre-implementation, non-certified, not frozen, evidence-seeking, and open to prototype and user or founder validation. Genesis Experience Studio owns this class. It does not authorize engineering.

Allowed working states are:

- `WORKING_DEFINITION`;
- `PROTOTYPE_CANDIDATE`;
- `VALIDATION_IN_PROGRESS`;
- `REVISED_WORKING_DEFINITION`; and
- `RETIRED_WORKING_DEFINITION`.

Experience Studio may recommend later promotion. It may not independently declare constitutional approval, engineering certification, a canonical standard, or production authorization.

## 14. Non-Constitutional Discoverability

`genesis/INSTITUTIONAL-ARTIFACT-INDEX.md` is the lightweight discoverability mechanism for these artifacts. It is navigation-only, non-authoritative, non-constitutional, non-lifecycle-bearing, and neither a certification nor promotion registry.

Registration does not approve, certify, freeze, publish, canonically promote, constitutionally authorize, or authorize engineering implementation.

Historical lifecycle and current Genesis disposition must be represented separately.

## 15. Recovery Evidence Classification

`genesis/recovery/GRR-20260810/` is classified as:

- provenance only;
- non-authoritative;
- non-lifecycle-bearing;
- not a registry; and
- not a promotion record.

Recovery provenance remains attached to the recovered corpus and does not grant authority to it.

## 16. Product Office / GPO Identifier Collision Rule

Historical Product Office artifacts must not overwrite, redefine, extend by implication, or repurpose current constitutional GPO identifiers.

Current identities remain authoritative:

- `GPO-0001`: Genesis Program Office
- `GPO-0002`: Platform Stabilization

Any future Product Office adoption must use non-conflicting identifiers. Historical original bytes may be preserved separately as provenance, and historical aliases may be mapped. This record does not rename or recover Product Office artifacts.

## 17. GMR-0001 Historical Certification Boundary

`GMR-0001` requires a separate recovery assessment. `GES-0001` may enter canonical custody before that assessment, but its historical certification claim remains historical self-description unless separately revalidated. This record does not recover or validate `GMR-0001`.

## 18. Integration Semantics

Integration of the recovered institutional corpus into `genesis/` establishes durable custody only. It does not activate embedded lifecycle labels, validate historical approvals, establish constitutional programs, or authorize downstream implementation.

## 19. GMX-0001 Future Placement

The proposed future target is `genesis/experience-studio/GMX-0001/`. The Experience Studio model is architecturally approved, but this GMX target remains proposed and is not effective before governance integration and separate GMX authorization.

GMX-0001 remains suspended. No relocation has occurred, and no Experience Studio root becomes effective merely through this candidate. Future relocation requires approved architecture governance, a separately authorized GMX remediation task, and revalidation.

## 20. Constitutional Boundary

This record does not amend `genesis/CONSTITUTION.md`, modify constitutional catalogs or registries, establish constitutional institutions, promote vision packages constitutionally, or override the RAR -> ARD -> ADR process.

## 21. Review and Change Control

Architecture review is complete through `ARD-0002` and `ADR-0014`. Initial effectiveness still requires review by Genesis Documentation, Governance Operations, Engineering Leadership, and CODEOWNERS, followed by approved repository integration. Future material changes to roots, artifact classes, or authority boundaries follow the repository governance process and require architecture review when they affect repository architecture.

## 22. Effective Status

**ARCHITECTURE APPROVED WITH CONDITIONS - REPOSITORY IMPLEMENTATION NOT EFFECTIVE**

The authorized human Architecture Review Board disposition is recorded in `ARD-0002`. Remaining reviews, publication, and integration are pending. The recovery branch remains isolated, and this institutional model is not currently effective repository authority on main.