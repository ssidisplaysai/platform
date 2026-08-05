# 02 Corrupt State Assurance

Objective:

- Add explicit negative-path proof that corrupt persisted state is rejected and runtime fails closed.

Added test evidence:

- tests/knowledge/gkn-1001-knowledge-foundation.test.ts
- New test: fails closed for corrupt persisted state and does not silently repair.

Assurance coverage:

1. Detects malformed or invalid persisted state
- PASS
- Corrupt fixture with malformed JSON and invalid schema input is rejected.

2. Rejects unsupported schema/structural corruption
- PASS
- File store now throws deterministic KnowledgeError STATE_CORRUPT.

3. Fails closed
- PASS
- createGenesisKnowledgeRuntime rejects; runtime is not initialized.

4. No silent repair
- PASS
- Corrupt file content remains unchanged after failure.

5. No partial initialization
- PASS
- No runtime object produced on corrupt load path.

6. Deterministic error behavior
- PASS
- Error code/state severity fixed: STATE_CORRUPT / CRITICAL.
