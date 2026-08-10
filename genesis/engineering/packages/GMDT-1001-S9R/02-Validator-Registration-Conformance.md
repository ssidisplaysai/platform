# 02 Validator Registration Conformance

Verification results:
- A. exact duplicate registration rejects: only for direct registerValidator() calls, not for external startup loop with first-wins guard.
- B. second registration for same family silently ignored: yes in baseline startup path due to continue guard.
- C. family aliases unintentionally collapsed: no alias collapsing in code; each family key is explicit.
- D. multiple distinct validators map to one family: yes in baseline startup path because each external integration attempted all external families; later integrations were silently ignored per family.

Conformance target:
- one explicit authoritative registration per family,
- duplicate authoritative claim rejects,
- no overwrite, no silent ignore.
