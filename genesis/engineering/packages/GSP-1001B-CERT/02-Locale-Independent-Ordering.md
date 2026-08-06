# 02 Locale Independent Ordering

Condition target:

- GSP-A-C001

Problem addressed:

- Shared ordering paths used localeCompare, which is locale-sensitive.

Implementation summary:

1. Added shared comparator compareDeterministicStrings in src/platform/shared/utilities/deterministic.ts.
2. Comparator uses Unicode code-point ordering, not environment locale.
3. Replaced locale-sensitive ordering in shared ordering paths:
- deterministicSort
- deterministicUnique
- deterministicPairs
- semver prerelease lexical comparator
- LifecycleManager handler sorting
- HealthService provider sorting
- InvariantEngine rule sorting

Deterministic comparator semantics:

1. Equality: exact string identity yields 0.
2. Ordering: Unicode code-point lexical walk by scalar units.
3. Prefix behavior: shorter exact prefix sorts before longer continuation.
4. Case behavior: deterministic by code points (ASCII uppercase sorts before lowercase).
5. No locale default usage and no external dependency.

Outcome:

- Locale-sensitive ordering removed from certified shared ordering paths.