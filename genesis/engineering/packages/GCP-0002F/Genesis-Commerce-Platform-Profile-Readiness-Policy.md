# Genesis Commerce Platform Profile Readiness Policy

## Readiness Output Contract
Every profile readiness evaluation returns:
1. ready
2. warnings
3. blockers
4. timestamp
5. checkedConditions

## Baseline Readiness Conditions
1. profile_enabled
2. status_permits_operation
3. version_present

## Type-Specific Rules
1. WordPress profile requires baseUrlReference and credentialReference.
2. Workflow profile requires workflowReference, providerReference, retry policy, and timeout references.
3. Prompt profile requires promptReference and providerReference.
4. Image profile requires provider and prompt references.
5. SEO profile requires title/meta/schema/openGraph/slug/canonical references.
6. Brand profile requires logo/palette/typography/voice/default CTA references.
7. Publishing profile requires linked WordPress/workflow/prompt/SEO profiles.
8. Analytics profile requires provider reference.

## Determinism
1. Identical profile state and lookup data produce identical readiness decisions.
2. No external calls are performed during readiness evaluation.
