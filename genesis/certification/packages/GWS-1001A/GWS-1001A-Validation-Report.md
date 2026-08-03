# GWS-1001A Validation Report

Validation scope:
- Independent certification evidence execution on baseline commit f6e807c.

Environment:
1. OS: Windows
2. Node: v24.18.0
3. npm: 11.16.0
4. Jest: 30.4.1

Command results:
1. npm run typecheck -> PASS
2. npm run test:template-validation -> PASS
3. npm run quality:ci -> PASS
4. npm run test:quality-regression -> PASS
5. npm test -- --runInBand tests/scheduling tests/gop/mission-control-scheduling.test.ts tests/gop/mission-control-workflow.test.ts tests/gop/mission-control-messaging.test.ts tests/gop/mission-control-authorization.test.ts -> PASS

Conclusion:
- Validation evidence supports certification decision recorded in 17-Certification-Decision.md.
