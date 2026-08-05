# 06 Foundation Maintenance

## Purpose

Repair shared repository baseline defects that are outside platform ownership but block validation or certification quality gates.

## When it occurs

Foundation maintenance is triggered after independent validation or certification identifies inherited, non-platform defects (for example toolchain or shared runtime alignment issues).

## Example from proven chain

- GBM-0001 resolved inherited shared TypeScript/Prisma baseline failures (C01 and C02) without changing Knowledge ownership or functionality.

## How it differs from platform engineering

1. Foundation maintenance scope is shared infrastructure/tooling.
2. Platform engineering scope is platform-owned runtime/capabilities.
3. Foundation maintenance must not introduce platform features.

## How it differs from platform condition closure

1. Foundation maintenance closes shared baseline conditions.
2. Platform condition closure addresses platform-owned assurance gaps.
3. Foundation maintenance and condition closure should be separate work orders and separate commits.

## Entry criteria

1. Inherited baseline defect independently verified.
2. Defect ownership shown to be outside platform implementation.

## Exit criteria

1. Shared baseline repaired.
2. Required validation passes.
3. No platform ownership drift introduced.
