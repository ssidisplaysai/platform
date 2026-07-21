# Genesis Architecture Freeze Records

Status: Approved
Classification: Genesis Governance Library
Type: Architecture Freeze Record Index

## Purpose

This directory contains Architecture Freeze Records (AFRs) for Genesis.
AFRs certify long-term architectural baselines after architecture, governance, implementation, and validation have reached sufficient maturity for permanent preservation.

## What Architecture Freeze Records Are

An Architecture Freeze Record is a governance artifact that declares a baseline architecture frozen for future platform work.
It identifies the certified scope, permanent architectural contracts, governance constraints, and the boundaries future milestones must preserve.

AFRs are used when Genesis needs more than a local decision or a review disposition.
An AFR establishes an enduring architectural foundation that later milestones may extend, compose, and integrate with, but must not redesign without formal governance approval.

## Difference Between ADR, GAR, GD, and AFR

### ADR

Architecture Decision Records capture a specific architectural decision, its rationale, consequences, and alternatives.
ADRs define or amend decisions.

### GAR

Genesis Architecture Reviews evaluate an artifact, milestone, or architecture slice against defined review criteria.
GARs assess readiness, quality, and conformance.

### GD

Genesis Decisions are governance authority decisions that approve, reject, seal, or otherwise formally dispose of a milestone or package.
GDs enact governance outcomes.

### AFR

Architecture Freeze Records certify that an architectural baseline is mature enough to become a long-term protected foundation.
AFRs freeze the architectural substrate itself, define what future work must preserve, and establish the governance rule that redesign requires formal approval.

## Governance Meaning

When an AFR is approved:

1. The frozen baseline becomes authoritative for future work in the covered scope.
2. Extensions and integrations remain allowed if they preserve frozen contracts and invariants.
3. Foundational redesign requires formal governance review and explicit approval.
4. Long-term architectural drift is treated as a governance defect, not an ordinary implementation change.

## Current Records

1. AFR-0004 - Genesis Runtime Foundation Freeze v1.0
2. AFR-0007 - Genesis Constitutional Release 1.0
