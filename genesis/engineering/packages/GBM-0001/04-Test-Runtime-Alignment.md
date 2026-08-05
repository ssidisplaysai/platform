# 04 Test Runtime Alignment

Objective:

- Ensure GOP/shared test execution always has generated Prisma client artifacts.

Implemented remediation:

1. Added shared pretest hook to run prisma:generate before npm test entrypoint.

Files modified:

- package.json

Outcome:

- npm test -- --runInBand tests/gop now passes.
- Shared GOP Prisma test runtime alignment restored.
