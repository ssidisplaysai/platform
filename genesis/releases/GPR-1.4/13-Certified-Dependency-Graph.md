# 13 Certified Dependency Graph

Certified dependency relationships:
1. Genesis Constitution
2. Identity depends on Constitution.
3. Authentication depends on Identity and Constitution.
4. Authorization depends on Identity, Authentication, and Constitution.
5. Messaging depends on Authentication, Authorization, and Constitution.
6. Workflow depends on Messaging, Authentication, Authorization, and Constitution.
7. Scheduling depends on Messaging, Authentication, Authorization, Workflow contracts, and Constitution.
8. Mission Control depends on Authentication, Authorization, Messaging, Workflow, Scheduling, and Repository Quality telemetry inputs.
9. Repository Quality underpins platform delivery governance across all capabilities.

Graph integrity decision:
- Certified dependency chain remains coherent and complete for GPR-1.4.
