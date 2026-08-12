# EAR-0006 Navigation Integration Specification

Artifact ID: EAR-0006
Decision Parent: GCD-0004
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Enterprise Operating System Governance

## Purpose

Define how Genesis consumes Enterprise Application Registry metadata to generate enterprise navigation and launch behavior.

## Navigation Discovery Rules

1. Genesis discovers visible applications from registry records in Registered or Active state.
2. Navigation visibility is filtered by permissions metadata and identity context.
3. Company grouping is generated from the company field.
4. Display labels are generated from displayName.
5. Launch targets are generated from launchUrl.

## Navigation Governance Rules

1. Navigation generation is metadata-driven and deterministic.
2. Navigation does not imply application code ownership by Genesis.
3. Missing or invalid launchUrl SHALL block Active visibility.
4. Permission mismatch SHALL hide entries from unauthorized viewers.

## Consumption Model

Genesis consumes registry metadata for:
- Mission Control company grouping
- per-user visibility filtering
- launch destination resolution
- compatibility awareness indicators

Genesis SHALL NOT mutate application-owned business-domain metadata through navigation rendering.
