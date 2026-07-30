# GPD-0001A: Genesis Baseline Freeze Policy

Status: ACTIVE
Work Order: GPT-0001
Date: 2026-07-30
Applies To: GPR-1.0 baseline and inherited certified chain

## Policy Purpose
Define what is frozen in Genesis Platform Baseline 1.0 and what limited change categories are permitted after baseline certification.

## Frozen Baseline Components
- Constitutional Foundation.
- Enterprise Application Registry.
- Enterprise Health Platform.
- Mission Control.
- GLW canonical integration pattern.
- GPR-1.0 release documentation.

## Permitted Changes
- Defect remediation.
- Security remediation.
- Certification condition closure.
- Compatibility maintenance.
- Required production hardening.
- Approved extension through a new versioned work order.

## Prohibited Changes
- Unapproved architecture redesign.
- Convenience refactoring.
- Duplicate service creation.
- Application-specific logic added to platform services.
- Silent contract changes.
- Unversioned interface changes.
- Rewriting certification history.
- Modifying frozen release evidence.

## Exception Process
1. Identify business or technical necessity.
2. Identify affected certified component.
3. Assess constitutional and architecture impact.
4. Create a new governed work order.
5. Run regression and certification review.
6. Publish additive evidence.
7. Version the affected baseline.

## Control Requirements
- Every exception proposal must include business-value or production-necessity rationale.
- Every approved exception must preserve additive governance history.
- Every exception affecting certified dependencies requires certification reassessment scope.

## Non-Authorization Statement
This policy governs change approval criteria only. It does not itself authorize implementation work.