# Genesis BGE Provenance Recovery Audit v1.0

## Scope

This is a read-only forensic provenance audit. It does not modify the historical release tag, branch, or source tree. It does not restore, apply, cherry-pick, or merge anything.

## Historical release state

- Historical tag: genesis-platform-v1.1.0
- Historical SHA: 0bef398501a37096408c0c1c38043e3f8a72dfd3
- Historical branch: release/genesis-platform-1.1
- Historical tag modified: NO

## Proven facts

### 1) Current working tree contains BGE source

The active working tree on the historical release branch contains the BGE implementation and API surface:

- [src/lib/bge/ids.ts](src/lib/bge/ids.ts)
- [src/lib/bge/prisma-repository.ts](src/lib/bge/prisma-repository.ts)
- [src/lib/bge/models.ts](src/lib/bge/models.ts)
- [src/lib/bge/services.ts](src/lib/bge/services.ts)
- [src/lib/bge/repository.ts](src/lib/bge/repository.ts)
- [src/lib/bge/runtime.ts](src/lib/bge/runtime.ts)
- [src/app/api/bge](src/app/api/bge)
- [tests/bge/bge-api.test.ts](tests/bge/bge-api.test.ts)
- [tests/bge/bge-convergence.test.ts](tests/bge/bge-convergence.test.ts)
- [tests/bge/bge-prisma-repository.test.ts](tests/bge/bge-prisma-repository.test.ts)
- [tests/bge/bge-repository-composition.test.ts](tests/bge/bge-repository-composition.test.ts)

These files are present in the live working tree but are not tracked by the historical release commit.

### 2) Historical tag does not contain the BGE tree

The release tag was inspected directly by Git tree listing. The BGE paths are absent from genesis-platform-v1.1.0.

The following expected paths are absent in the historical tag:

- src/lib/bge/ids.ts
- src/lib/bge/api.ts
- src/lib/bge/prisma-repository.ts

### 3) The release branch and historical tag are identical at the frozen SHA

The current branch and tag resolve to the same frozen SHA:

- HEAD: 0bef398501a37096408c0c1c38043e3f8a72dfd3
- merge-base with genesis-platform-v1.1.0: 0bef398501a37096408c0c1c38043e3f8a72dfd3

The working tree is dirty, but the tracked Git tree is still the same as the historical tag. The BGE source is therefore a local working-tree artifact, not a committed historical release artifact.

### 4) There is no sparse checkout issue

- git sparse-checkout list: no sparse checkout state
- git config --get core.sparseCheckout: no configured sparse checkout
- git worktree list: standard worktree layout

This is not a sparse checkout bug.

### 5) There is no wrong-repository-root issue

The repository root is correct for the active worktree and contains the canonical src tree.

### 6) TypeScript and Jest alias configuration are valid

The tsconfig and Jest configuration both map @/ to the src tree correctly.

The alias failure pattern is therefore secondary evidence caused by the missing source tree, not the root cause.

### 7) The BGE source is absent from visible Git history

git log --all -- src/lib/bge returned no commit history for the BGE tree. The BGE files are not present in the visible reachable Git history of this repo.

### 8) The strongest local provenance source is the present dirty worktree snapshot

Because the BGE files are present in the current local working tree and are tied to the same release branch/state, the strongest recoverable provenance source is the exact current working-tree snapshot on the release branch, not the historical tag.

## Candidate provenance ledger

| Source type | Ref/path | SHA | BGE files | API files | Test files | Prisma state | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Git tag | genesis-platform-v1.1.0 | 0bef398501a37096408c0c1c38043e3f8a72dfd3 | 0 | 0 | 0 | Absent | Low | Historical tag is frozen and intentionally not modified. |
| Git branch | release/genesis-platform-1.1 | 0bef398501a37096408c0c1c38043e3f8a72dfd3 | 0 in Git tree | 0 in Git tree | 4 in Git tree only | Absent in historical tracked tree | Low | The branch remains frozen but the BGE source is untracked in the working tree. |
| Local worktree snapshot | current working directory | unknown (uncommitted snapshot) | Full local set present | Full local set present | Full local set present | Present in worktree | High | Strongest recoverable local provenance, but not Git-committed. |
| Worktree clone | platform-glw-1.2 | 0bef398501a37096408c0c1c38043e3f8a72dfd3 | 0 | 0 | 0 | Not present | Low | Correct branch base but no BGE source. |
| Other worktrees | multiple known local repos | variable | 0 | 0 | 0 | Not present | Low | No BGE implementation was found in adjacent worktrees. |

## Root cause classification

Primary classification: CERTIFIED_COMMIT_MISSING_BGE_SOURCE

Supporting evidence:

- BGE files are absent from the historical tag.
- The current release branch and tag share the same SHA.
- BGE files exist only as untracked local source artifacts in the working tree.
- No reachable Git history contains the BGE tree.
- Alias/configuration failures are downstream symptoms of the missing source.

## Release impact

The historical release tag does not actually contain the BGE implementation that the certification artifacts imply was exercised in tests and runtime.

This is a provenance gap, not a code repair issue.

## Recommended recovery path

The smallest safe recovery path is:

1. Preserve the historical tag and SHA exactly as evidence.
2. Preserve the current dirty working-tree BGE snapshot exactly as the best local provenance source.
3. Create a new recovery branch from the strongest valid source after a full provenance review.
4. Re-run certification against the new branch and create a new corrected release identity with a new SHA.

Do not reuse or move genesis-platform-v1.1.0.

## Final conclusion

- BGE source found: YES
- BGE source found in historical tag: NO
- Best recoverable provenance source: current local worktree snapshot
- Recovery classification: EXACT_WORKTREE_SNAPSHOT_FOUND
- Safe to begin implementation: NO
- Safe to resolve provenance without changing the historical tag: YES
