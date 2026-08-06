# 05 Locale Portability Test Evidence

Focused evidence source:

- tests/shared/gsp-1001-shared-framework.test.ts

New/expanded assertions:

1. deterministic comparator is locale-independent and stable.
2. deterministic utilities preserve caller-owned arrays and stable lexical ordering.
3. semantic version comparison remains deterministic for prerelease lexical and numeric identifiers.
4. repeated ordering runs produce identical outputs.
5. case handling is deterministic and explicit.
6. non-ASCII ordering behavior deterministic by code points.
7. no localeCompare dependency remains in shared ordering paths (verified by source scan).

Observed outcomes:

1. Focused shared suite: PASS
- Suites: 1
- Tests: 30
- Failures: 0
- Skips: 0
2. Shared source locale API scan:
- localeCompare / Intl.Collator hits in src/platform/shared: 0

Condition disposition:

- GSP-A-C001 CLOSED