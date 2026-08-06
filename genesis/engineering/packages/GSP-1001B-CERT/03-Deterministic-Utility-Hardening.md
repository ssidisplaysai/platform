# 03 Deterministic Utility Hardening

Updated file:

- src/platform/shared/utilities/deterministic.ts

Hardening details:

1. Introduced compareDeterministicStrings.
2. deterministicSort now uses explicit comparator.
3. deterministicUnique now uses explicit comparator.
4. deterministicPairs key ordering now uses explicit comparator.

Behavioral evidence targets covered:

1. Stable ordering across repeated runs.
2. Duplicate handling in deterministicUnique.
3. Empty input behavior remains bounded.
4. Uppercase/lowercase behavior deterministic.
5. Numeric-looking strings ordered lexically by code points.
6. Non-ASCII ordering deterministic by code points.
7. Caller-owned arrays remain unmodified.

Boundary note:

- Utilities provide lexical ordering only; domain-aware ordering remains caller responsibility.