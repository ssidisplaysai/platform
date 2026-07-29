# Enterprise Semantic Authority

## Canonical Definition Rule
Every semantic concept has exactly one authoritative definition and exactly one primary owner domain.

## Alias Rule
Aliases are permitted for discoverability but are non-authoritative and must resolve to one canonical term.

## Deprecated Terminology Rule
Deprecated terms remain readable for historical traceability and must map to an active canonical replacement.

## Reserved Terminology Rule
Reserved terms may not be redefined or reused for unrelated meanings.
Reserved words are governed by terminology governance policy.

## Naming Convention
- Concept names use singular noun form.
- Role-specific variants use explicit suffixes only when needed.
- Authority IDs use stable canonical naming in all governance artifacts.

## Ownership Rules
- Exactly one primary owner domain per concept.
- Secondary consumers may propose change but cannot approve canonical meaning alone.
- Approval authority and change authority are explicit in ownership matrix.

## Versioning
- Semantic versions increment on meaning-impacting change.
- Alias/deprecation updates increment minor version.
- Editorial-only clarification increments patch version.

## Inheritance
All downstream packages, policies, applications, AI agents, workflows, metrics, and reports must inherit GSTP-0002 canonical semantics.