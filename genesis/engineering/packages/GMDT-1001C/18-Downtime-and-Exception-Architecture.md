# 18 Downtime and Exception Architecture

Runtime flows:
- start downtime
- end downtime
- record execution exception
- apply hold reference
- release hold reference

Downtime and exception facts include:
- work center
- machine
- operation
- Work Order
- reason
- duration
- audit evidence

Effects on health and metrics:
- downtime contributes to runtime metrics and availability summaries
- execution exceptions may degrade health and block progression depending on severity

Boundary rule:
- do not create Maintenance ownership
- Maintenance is a future separable capability, not part of this blueprint
