# Repository Governance Guide

## Purpose

Define minimum governance controls required for disciplined engineering execution in Genesis.

## Governance Baseline

1. CODEOWNERS is mandatory.
2. Pull request template is mandatory.
3. Issue templates are mandatory for bugs, features, and architecture proposals.
4. Security policy and contribution guide are mandatory.
5. Architecture change process must follow RAR -> ARD -> ADR.

## Decision Tiers

1. Tier 1: Architecture decisions (Board authority).
2. Tier 2: Engineering process and quality gates (Engineering leadership authority).
3. Tier 3: Team implementation decisions within approved boundaries (Subsystem owner authority).

## Pull Request Governance

1. Every PR must include architecture traceability when relevant.
2. Every PR must include validation evidence.
3. Critical path changes require owner approval from CODEOWNERS.

## Issue Governance

1. Bug reports include impact and reproducibility.
2. Feature requests include acceptance criteria and boundary declaration.
3. Architecture proposals include risk and governance path.

## Auditability

1. Governance documents live in repository and are versioned.
2. Process changes require documented rationale in pull requests.
