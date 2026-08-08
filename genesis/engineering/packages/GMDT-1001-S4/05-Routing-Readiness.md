# 05 Routing Readiness

Routing readiness is set true only after:
- work-order association succeeds.
- tenant/work-order consistency is validated.
- graph validation passes.
- step-level structural references and operation identities pass.

Blocking route invariant failures reject creation and emit auditable evidence.
