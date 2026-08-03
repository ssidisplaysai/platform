# 03 Certified Capability Catalog

1. Genesis Constitution
- Certification package: constitutional baseline governance package
- Final decision: CERTIFIED
- Certification commit: inherited certified baseline reference
- Dependencies: platform-wide governance authority

2. Identity
- Certification package: Identity certification chain
- Final decision: CERTIFIED
- Certification commit: inherited certified baseline reference
- Dependencies: Constitution

3. Authentication
- Certification package: GID-1002C
- Final decision: CERTIFIED
- Certification commit: inherited certified baseline reference
- Dependencies: Identity, Constitution

4. Authorization
- Certification package: GID-1003C
- Final decision: CERTIFIED
- Certification commit: inherited certified baseline reference
- Dependencies: Identity, Authentication, Constitution

5. Messaging
- Certification package: GMP-1001C
- Final decision: CERTIFIED
- Certification commit: inherited certified baseline reference
- Dependencies: Authentication, Authorization, Constitution

6. Workflow
- Certification package: GWF-1001E
- Final decision: CERTIFIED
- Certification commit: a62dd12
- Dependencies: Messaging, Authentication, Authorization, Constitution

7. Scheduling
- Certification package: GWS-1001C
- Final decision: CERTIFIED
- Certification commit: f2ddf71
- Dependencies: Messaging, Authentication, Authorization, Workflow integration contracts, Constitution

8. Repository Quality
- Certification package: GQI-0002
- Final decision: COMPLETE
- Certification commit: inherited quality baseline reference
- Dependencies: Constitution, engineering governance

9. Mission Control
- Certification package: platform mission control integration baseline
- Final decision: COMPATIBLE WITH CERTIFIED CAPABILITIES
- Certification commit: inherited baseline reference
- Dependencies: Authentication, Authorization, Messaging, Workflow, Scheduling, Repository Quality
