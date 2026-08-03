# 09 Known Limitations

Accepted residual limitations (certification-accepted):
1. Scheduling single-writer guarantee is explicit; distributed multi-node atomic claim semantics are not part of current certified scope.
2. File-backed scheduling persistence relies on operational backup and restore procedures.
3. Transient messaging outages can still produce bounded retry exhaustion and schedule failure conditions requiring operational handling.
4. Audit-store persistence failures are visible and measurable but may still require operational response to restore durable audit continuity.

Note:
- Resolved certification conditions are intentionally excluded from this limitations list.
