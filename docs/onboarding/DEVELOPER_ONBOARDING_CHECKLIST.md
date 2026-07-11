# Developer Onboarding Checklist

## Objective

Enable a senior engineer to become productive in Genesis with minimal ambiguity.

## Day 1

1. Read README.md.
2. Read REPOSITORY_OVERVIEW.md.
3. Read REPOSITORY_VISION.md.
4. Read GENESIS_ENGINEERING_HANDBOOK.md.
5. Review docs/governance/OWNERSHIP_MATRIX.md.

## Environment Setup

1. Install Node dependencies with npm install.
2. Run npm run lint.
3. Run node tools/genesis/genesis.mjs test.
4. Run npm run dev for local app shell verification.

## Architecture And Governance Orientation

1. Read docs/architecture/0027-ard-0001-business-genome-ir-final-package.md.
2. Read docs/architecture/0028-afr-0001-genesis-architecture-freeze-record.md.
3. Read docs/architecture/0029-err-0001-engineering-readiness-review.md.
4. Review branch strategy and PR requirements.

## Workflow Orientation

1. Create a branch using docs/governance/BRANCH_STRATEGY.md.
2. Open a draft PR using the template.
3. Apply proper labels and milestone.
4. Request required owner reviews.

## Questions Every Engineer Must Answer

1. What is Genesis and what is its core principle?
2. How is repository ownership organized?
3. How do I run lint, build, and tests?
4. How do I propose architecture changes?
5. How do I create and validate compiler changes?
6. How do releases and promotion governance work?

## Onboarding Exit

Onboarding is complete when engineer can independently run baseline workflows and submit a compliant PR.
