# 09 Concurrency

Implemented behavior:

1. expected-version checks for every affected balance
2. source expected version required for source-affecting movements
3. destination expected version required for destination-affecting movements
4. stale source version rejects deterministically
5. stale destination version rejects deterministically
6. no partial balance update on concurrency failure
7. deterministic conflict ordering by source validation then destination validation
8. no silent last-write-wins behavior