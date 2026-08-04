# 06 Validation Standard

Mandatory validation command classes for every engineering package:

1. typecheck
2. template validation
3. quality CI
4. quality regression
5. platform-focused tests

Environment capture requirements:

- Timestamp
- Operating system
- Runtime versions
- Test framework version
- Branch and commit anchor context

Validation reporting requirements:

- Command list executed
- Pass/fail outcome for each command
- Suite/test counts where applicable
- Warning/failure/skip disclosure
- Final validation conclusion

Failure handling:

- Any failed required validation blocks package completion.
- Failure resolution must be completed before certification handoff.
- Re-run and record updated validation evidence after corrections.
