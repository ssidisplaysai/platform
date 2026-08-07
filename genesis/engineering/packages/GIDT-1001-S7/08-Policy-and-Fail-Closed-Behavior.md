# 08 Policy and Fail-Closed Behavior

Fail-closed rules:
- Mandatory product and product-variant validation blocks mutation on failure
- Missing mandatory validator blocks mutation

Fail-open rules:
- Optional external reference validation records evidence and continues

This keeps atomic command semantics while enabling gradual validator rollout.
