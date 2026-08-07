# 07 Balance Mutation

Extended controlled internal balance operations:

1. applyIncrease
2. applyDecrease
3. applyTransferOut
4. applyTransferIn
5. applyQuarantine
6. applyReleaseFromQuarantine
7. applyWriteOff

Preserved guarantees:

1. tenant isolation
2. expected-version checks
3. quantity invariants
4. deterministic version increments
5. immutable balance identity
6. no public general-purpose quantity mutation surface