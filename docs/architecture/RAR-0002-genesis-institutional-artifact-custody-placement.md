# Request for Architecture Review - Genesis Institutional Artifact Custody and Placement

**Document ID:** RAR-0002
**Title:** Request for Architecture Review - Genesis Institutional Artifact Custody and Placement
**Date:** August 27, 2026
**Status:** REQUESTED REVIEW - NOT APPROVED
**Subject:** Institutional artifact custody, placement, classification, and discoverability
**Prepared By:** Governance candidate preparation process
**Review Stage:** Pre-Integration Architecture Review

---

## Executive Summary

The Genesis institutional corpus has been recovered byte-for-byte and published on an isolated recovery branch. This request asks the Architecture Review Board to decide how Genesis may integrate that historical corpus into durable repository custody without activating historical lifecycle claims or creating constitutional, engineering, release, or production authority.

**Requested review status:** REQUESTED REVIEW - NOT APPROVED

No Board disposition, Documentation approval, Governance Operations approval, Engineering Leadership approval, CODEOWNER approval, or ADR acceptance is represented by this request.

## 1. Question Presented

Should Genesis adopt the proposed custody/authority distinction, non-constitutional institutional roots, artifact classes, and navigation-only index so the recovered corpus can enter repository custody without institutional promotion?

## 2. Decisions Requested

The Board is asked to review:

1. Canonical custody versus canonical authority semantics.
2. Proposed non-constitutional roots: `genesis/founder-office/`, `genesis/ceo-office/`, and `genesis/experience-studio/`.
3. Continued multi-class use of `genesis/philosophy/`.
4. Proposed `VISION_PACKAGE` non-constitutional classification.
5. Proposed deterministic classification of `GPW-1001`, `GPW-1002`, and `GPW-1003` as `VISION_PACKAGE`.
6. `genesis/INSTITUTIONAL-ARTIFACT-INDEX.md` as navigation-only and non-authoritative.
7. `genesis/recovery/GRR-20260810/` as provenance-only.
8. Protection of constitutional `GPO-0001` and `GPO-0002` from historical Product Office identifier reuse.
9. Historical lifecycle labels as historical self-description until independently revalidated.
10. `genesis/experience-studio/GMX-0001/` as a proposed, not approved, future placement.

## 3. Evidence Baseline

| Evidence | Identity | Purpose |
|---|---|---|
| Current main baseline | `8abf488fdb74d026755e1c766aee446837eb3a59` | Current authority and repository structure |
| Recovery branch | `origin/recovery/genesis-institutional-corpus-20260810` | Byte-preserved historical corpus |
| Recovery HEAD | `4815c606897346335b8bdcc2309cfbb588ba933f` | 43 corpus files and four provenance files |
| Phase 6 candidate | `9c8ddbf5cf1af3cafc1d9eba7359a4284ffaf040` | Initial custody and placement implementation |
| Authority record | `docs/governance/GENESIS_INSTITUTIONAL_ARTIFACT_CUSTODY_AND_PLACEMENT.md` | Proposed custody and placement rules |
| Institutional index | `genesis/INSTITUTIONAL-ARTIFACT-INDEX.md` | Proposed non-authoritative navigation |
| GRN taxonomy | `genesis/engineering/packages/GRN-0002/` | Existing classification mechanism |

The recovery branch is not merged. The governance candidate is local and unpublished. GMX-0001 remains suspended.

## 4. Current Authority and Process

- `genesis/CONSTITUTION.md` assigns constitutional ownership to the Architecture Review Board and requires an ADR for constitutional changes.
- `docs/governance/REPOSITORY_GOVERNANCE_GUIDE.md` assigns architecture decisions to Tier 1 Board authority and requires RAR -> ARD -> ADR routing.
- `docs/governance/OWNERSHIP_MATRIX.md` assigns architecture governance to the Architecture Review Board, documentation to Genesis Documentation, and repository controls to Governance Operations with Engineering Leadership.
- `.github/CODEOWNERS` routes `docs/architecture/` to the Architecture Review Board and `docs/governance/` to the Architecture Review Board and Engineering Leadership. The repository fallback routes other candidate paths to the Architecture Review Board and Engineering Leadership.

This RAR begins review. It does not complete review.

## 5. Scope and Non-Scope

In scope:

- repository custody semantics;
- non-constitutional placement;
- artifact classification;
- navigation-only discoverability;
- historical lifecycle interpretation; and
- future integration sequencing.

Out of scope:

- constitutional amendment;
- approval of recovered artifact content;
- retroactive certification;
- recovery of GMR, GUX, or Product Office artifacts;
- correction of historical references;
- GMX relocation or resumption;
- runtime, UI, API, schema, persistence, or prototype implementation; and
- merge or publication.

## 6. Recommended Architecture Position

The review package recommends, but does not select or approve:

- canonical custody remains distinct from canonical authority;
- Founder Office, CEO Office, and Experience Studio remain non-constitutional;
- `genesis/philosophy/` may contain bounded non-equivalent philosophy and experience classes;
- `VISION_PACKAGE` is non-constitutional and excluded from constitutional package parity;
- GPW-1001, GPW-1002, and GPW-1003 receive deterministic proposed `VISION_PACKAGE` treatment;
- institutional navigation remains non-authoritative;
- recovery evidence remains provenance-only;
- constitutional GPO identifiers remain protected; and
- GMX placement remains proposed pending later remediation.

## 7. Alternatives

### Alternative A - Approve the Current Model

Use separate non-constitutional Founder Office, CEO Office, and Experience Studio roots; retain philosophy paths; define `VISION_PACKAGE`; and use one institutional index.

| Criterion | Assessment |
|---|---|
| Semantic clarity | High: intent, experience, and history have explicit owners |
| Current compatibility | Moderate: adds new roots and one package class |
| Scalability | High: clear future institutional homes |
| Accidental-authority risk | Low when custody disclaimers are enforced |
| Engineering-boundary risk | Low with deterministic `VISION_PACKAGE` treatment |
| Discoverability | High through one index |
| Migration cost | Low for recovered corpus; separate GMX remediation later |
| Recovered corpus effect | Preserves recovered paths unchanged |
| Constitutional implication | None if functions remain non-constitutional |

### Alternative B - Centralize Institutional Artifacts

Place all non-constitutional material beneath one common `genesis/institutions/` namespace.

| Criterion | Assessment |
|---|---|
| Semantic clarity | Moderate: common boundary but deeper mixed hierarchy |
| Current compatibility | Low: introduces a new central root and relocations |
| Scalability | High |
| Accidental-authority risk | Low |
| Engineering-boundary risk | Low |
| Discoverability | High |
| Migration cost | High: recovered paths and future GMX target change |
| Recovered corpus effect | Requires relocation or path aliases |
| Constitutional implication | None if explicitly non-constitutional |

### Alternative C - Keep Experience Material Under Engineering Packages

Use `genesis/engineering/packages/` for institutional and experience artifacts, relying on taxonomy alone.

| Criterion | Assessment |
|---|---|
| Semantic clarity | Low: working experience artifacts appear engineering-owned |
| Current compatibility | High physical compatibility |
| Scalability | Moderate |
| Accidental-authority risk | Moderate |
| Engineering-boundary risk | High without constant taxonomy awareness |
| Discoverability | Moderate |
| Migration cost | Low for GPW and current GMX paths |
| Recovered corpus effect | Office and philosophy paths still need treatment |
| Constitutional implication | Risk of catalog confusion, not direct amendment |

### Alternative D - Archive-Only Recovery

Integrate the corpus only beneath a historical archive and do not recognize institutional functions or active namespaces.

| Criterion | Assessment |
|---|---|
| Semantic clarity | High for provenance, low for future stewardship |
| Current compatibility | High |
| Scalability | Low for continuing work |
| Accidental-authority risk | Lowest |
| Engineering-boundary risk | Lowest |
| Discoverability | Moderate |
| Migration cost | High: requires relocating recovered paths |
| Recovered corpus effect | Converts original placement into archive-only structure |
| Constitutional implication | None |

## 8. Comparative Recommendation

Alternative A is recommended because it preserves historical paths, creates the clearest non-constitutional ownership boundaries, supports future GMX work, and requires the least migration. The recommendation is conditional on explicit pending-state semantics and deterministic GPW classification.

The Board may select another alternative, approve with conditions, require revision, or reject the proposal.

## 9. Risks and Controls

| Risk | Control |
|---|---|
| Git custody mistaken for approval | Custody/authority rule and separate disposition field |
| Historical `FROZEN` or `CERTIFIED` treated as current | Historical lifecycle interpretation and revalidation requirement |
| New roots imply constitutional institutions | Explicit non-constitutional boundaries |
| GPW directories counted as constitutional roots | Proposed matrix classification and parity exclusion |
| Institutional index treated as registry | Navigation-only disclaimer |
| GPO identifiers repurposed | Explicit collision rule |
| GMX moved before approval | Proposed-target wording and suspension gate |
| Taxonomy activated by candidate existence | Effectiveness condition tied to approval and integration |

## 10. Conditions If Approved

Recommended conditions are:

1. Record an authorized ARD disposition.
2. Create and accept an ADR only after the ARD authorizes the decision.
3. Complete Documentation, Governance Operations, Engineering Leadership, and CODEOWNER reviews.
4. Publish governance separately before corpus integration.
5. Keep historical lifecycle claims non-effective until separately revalidated.
6. Keep GMR/GUX/Product Office work outside this integration.
7. Revalidate against current main before publication or integration.

## 11. Architecture Review Board Decision Worksheet

This worksheet is review material only. It is not an ARD and records no disposition.

- Authorized reviewer or Board: ____________________
- Review date: ____________________
- Evidence reviewed: ____________________
- Disposition: APPROVE / APPROVE WITH CONDITIONS / REVISION REQUIRED / REJECT
- Selected alternative: A / B / C / D / OTHER
- Conditions: ____________________
- Required follow-up: ____________________
- Signature or authoritative approval reference: ____________________

After authorized review, the decision must be recorded in a separate ARD using the repository's final Board-record convention.

## 12. Proposed ADR Body - Review Material Only

This is an unnumbered draft body for later ADR preparation. It is NOT ACCEPTED, NOT EFFECTIVE, and PENDING ARCHITECTURE REVIEW. No ADR file or identifier is created by this RAR.

### Title

Institutional Artifact Custody, Placement, and Non-Constitutional Classification

### Status

Proposed - Not Accepted - Not Effective - Pending Architecture Review

### Context

Genesis recovered institutional artifacts whose source lifecycle labels and directory structure predated durable Git custody. Current governance lacks an explicit distinction between repository custody and current authority for these artifact classes.

### Proposed Decision

If authorized by an ARD, adopt custody/authority separation; recognize the proposed non-constitutional roots; permit bounded multi-class philosophy placement; define `VISION_PACKAGE`; classify the three GPW packages deterministically; establish navigation-only institutional indexing; retain recovery evidence as provenance; protect GPO identifiers; defer GMR validation; and retain GMX placement as proposed pending separate remediation.

### Consequences

- Historical bytes and claims remain intact.
- Integration does not activate historical lifecycle labels.
- New non-constitutional roots receive explicit boundaries.
- GPW parity treatment becomes deterministic.
- Constitutional catalogs remain unchanged.
- Later GMR/GUX/Product Office and GMX tasks remain separate.

## 13. Genesis Documentation Review

No Documentation approval is recorded. Authorized reviewers should answer:

- Is historical lifecycle clearly separated from current disposition?
- Is the institutional index unmistakably navigation-only?
- Is canonical custody distinguishable from canonical authority?
- Are proposed roots clearly labeled as proposed before approval?
- Is GMX placement proposed rather than approved?
- Does any wording imply current certification, freeze, publication, or promotion?
- Does the index conflict with `DOCUMENTATION_INDEX.md` or another mechanism?
- Are artifact titles, identifiers, paths, and owners clear?

- Reviewer: ____________________
- Disposition: PENDING
- Approval reference: ____________________

## 14. Governance Operations Review

No Governance Operations approval is recorded. Authorized reviewers should answer:

- Is the constitutional boundary explicit?
- Are custody and authority distinct?
- Is proposed policy inactive before approval and integration?
- Are historical lifecycle claims treated correctly?
- Is change control sufficient?
- Are GPO collision and GMR boundaries preserved?
- Is recovery provenance non-authoritative?
- Is it explicit that integration alone grants no authority?

- Reviewer: ____________________
- Disposition: PENDING
- Approval reference: ____________________

## 15. Engineering Leadership Review

No Engineering Leadership approval is recorded. Authorized reviewers should answer:

- Is `VISION_PACKAGE` isolated from implementation packages?
- Are GPW classifications deterministic and pending?
- Is constitutional parity exclusion explicit?
- Can `EXPERIENCE_WORKING_DEFINITION` authorize engineering? It must not.
- Do CEO, Founder, or Experience artifacts create implementation obligations? They must not.
- Is GMX placement clearly proposed?
- Will engineers understand physical package placement and authority boundaries?

- Reviewer: ____________________
- Disposition: PENDING
- Approval reference: ____________________

## 16. CODEOWNER Routing

Current routing requires:

- `docs/architecture/`: `@genesis-architecture-review-board`
- `docs/governance/`: `@genesis-architecture-review-board`, `@genesis-engineering-lead`
- all other candidate paths through repository fallback: `@genesis-architecture-review-board`, `@genesis-engineering-lead`

The Ownership Matrix additionally identifies Genesis Documentation for documentation ownership and Governance Operations with Engineering Leadership for repository policy. No approval from these groups is represented here.

## 17. Publication and Integration Gate

The governance candidate must not be published or integrated until:

1. an authorized ARD records the Board disposition;
2. any approved ADR is completed after that disposition;
3. required Documentation, Governance Operations, Engineering Leadership, and CODEOWNER reviews are recorded;
4. pending-state revisions and deterministic classifications are accepted; and
5. current main and recovery identities are revalidated.

## 18. Requested Reviewer Action

1. Review RAR-0002 and its evidence.
2. Select an alternative and disposition using the worksheet.
3. Record the authorized disposition in a separate ARD.
4. If approved, authorize preparation and acceptance review of an ADR using the draft body.
5. Complete required Documentation, Governance Operations, Engineering Leadership, and CODEOWNER review records.
6. Return the governance candidate for publication authorization.

## 19. Request Status

**REQUESTED REVIEW - NOT APPROVED**

No architecture, documentation, governance, engineering, or CODEOWNER approval has occurred through creation of this request.