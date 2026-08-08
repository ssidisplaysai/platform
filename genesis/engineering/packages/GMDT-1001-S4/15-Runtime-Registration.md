# 15 Runtime Registration

Runtime now registers Slice 4 services deterministically:
- manufacturing.service.execution-routing
- manufacturing.service.operation-execution
- manufacturing.query.routing

Registration order is explicit in runtime lifecycle step 09b.

Forbidden registration boundaries remain enforced for material/output/resource/persistence families.
