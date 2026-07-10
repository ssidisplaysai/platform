# Branch Protection Recommendations

Apply to main and release branches.

## Required Settings

1. Require pull request before merging.
2. Require approvals from CODEOWNERS.
3. Require passing status checks.
4. Require branch to be up to date before merge.
5. Restrict force pushes and branch deletion.

## Recommended Required Checks

1. Lint
2. Build validation
3. Test suite baseline
4. Documentation and link checks
5. Architecture governance check

## Administrative Controls

1. Limit bypass permissions to engineering leadership.
2. Log and review any override actions.
3. Rotate repository admins with least privilege principles.
