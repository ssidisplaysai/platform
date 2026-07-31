# Certification Gates

## Purpose

Define repository prerequisites before any certification decision is issued.

## Mandatory Pre-Certification Gates

1. Repository integrity
- Working tree clean
- Branch and commit baseline verified
- No untracked certification-critical artifacts

2. Architecture and governance
- Architecture guardrails pass
- Governance validation passes
- No unresolved blocking architecture deviations

3. Static quality
- Repository typecheck gate passes (or approved scoped exclusion policy)
- Repository lint gate passes (or approved exception matrix)
- No unresolved blocker-level static analysis findings

4. Test quality
- Focused subsystem tests pass
- Required regression matrix passes
- Integration tests for affected boundaries pass

5. Security and dependency
- Dependency audit executed and recorded
- Critical vulnerabilities: zero
- High vulnerabilities: approved risk disposition required

6. Certification evidence
- Validation commands and outputs recorded
- Risk assessment documented
- Decision rationale tied to evidence

## Condition Classification Standard

1. Blocking
- Fails security, architecture, or behavior integrity requirements.
- Prevents safe production certification.

2. Non-blocking
- Does not alter current platform behavior integrity, but affects governance maturity, observability completeness, or process reliability.

## Required Certification Report Inputs

- command list
- pass/fail matrix
- residual risk register
- condition list with evidence and classification
- final binary recommendation

## Gate Failure Policy

Certification cannot be issued as CERTIFIED when any blocking gate fails.
