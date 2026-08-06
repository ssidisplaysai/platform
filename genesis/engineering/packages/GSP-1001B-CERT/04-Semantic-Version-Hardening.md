# 04 Semantic Version Hardening

Updated file:

- src/platform/shared/utilities/version.ts

Hardening details:

1. Prerelease lexical identifier comparison now uses compareDeterministicStrings.
2. Numeric prerelease identifiers remain numeric-ordered.
3. Numeric vs lexical precedence remains SemVer-aligned (numeric lower than lexical).
4. Major/minor/patch comparison remains numeric and deterministic.
5. Invalid semantic version comparisons still fail explicitly.

Intentional SemVer subset boundaries:

1. Accepted format: major.minor.patch with optional prerelease segments.
2. Build metadata (+metadata) is intentionally unsupported in current parser.
3. Prerelease identifiers are limited to ASCII alnum and hyphen via regex.

Outcome:

- Prerelease lexical ordering no longer relies on locale-sensitive APIs.