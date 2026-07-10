# Branch Strategy

## Branch Types

1. main: protected integration branch.
2. release/x.y: stabilization branches for release candidates.
3. feature/<subsystem>-<short-topic>: scoped engineering work.
4. fix/<subsystem>-<short-topic>: non-breaking fixes.
5. docs/<topic>: documentation and governance updates.

## Naming Rules

1. Use lowercase letters, numbers, and hyphens.
2. Include subsystem scope where practical.
3. Keep names concise and descriptive.

## Merge Policy

1. Changes merge through pull requests only.
2. Rebase or squash merge policy should be consistent per repository setting.
3. Direct pushes to main are disabled.

## Release Flow

1. Promote from main to release/x.y branch for stabilization.
2. Allow only release fixes and documentation updates in release branch.
3. Tag approved release commits.
