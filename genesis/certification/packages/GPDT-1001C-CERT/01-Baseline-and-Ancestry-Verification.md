# 01 Baseline and Ancestry Verification

Baseline verification:

1. Current branch: feature/gkn-1001-knowledge-foundation.
2. Current HEAD at certification start: b3cef24ea3275a6265ea2a65deed6e92baf7ec1f.
3. Baseline commits verified present:
- bf831775d00a8f1fe5d7a620e6389c8b78c3ff8c
- 59ef1d1e9175a600002ce7298c09521c77e04760
- 6cb7f2df0993ba7e3259feeba9892e6787447006
- 2541ad23eb314f6aa69b9786c0ae903ac51c7e32
- b3cef24ea3275a6265ea2a65deed6e92baf7ec1f

Lineage verification:

1. bf831775 -> 59ef1d1: true.
2. 59ef1d1 -> 6cb7f2d: true.
3. 6cb7f2d -> 2541ad2: true.
4. 2541ad2 -> b3cef24: true.

Workspace and policy checks:

1. Tracked workspace clean at certification start.
2. Runtime data remains excluded and untracked: data/.
3. No publication or release files started in baseline or condition-closure scope.
4. Original failed validation package GPDT-1001V is now committed and historically preserved.