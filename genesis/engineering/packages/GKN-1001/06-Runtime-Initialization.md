# 06 Runtime Initialization

Initialization sequence:

1. Resolve root data directory.
2. Construct file-backed store.
3. Construct coordinator and load validated canonical state.
4. Construct audit, metrics, health, and registry services.
5. Expose runtime with observability snapshot capability.
6. Expose singleton getter for process-stable runtime instance.

Fail-closed startup:

- Initialization exits with error when state cannot be validated or recovered safely.
