# 06 Claim Semantics

Implemented behavior:
1. Added optional atomic claim abstraction on claim store.
2. File claim store now performs compare-and-claim semantics under write lock.
3. Logical run-key conflicts are rejected deterministically to prevent duplicate claim ownership.
4. Expired claimed records are marked EXPIRED before new claim acquisition.
5. Claim records carry logicalRunKey when applicable.

Guarantee scope:
1. Deployment guarantee remains explicitly single-writer abstraction scope.
2. Implementation does not overstate cross-process or distributed consensus guarantees.
3. Multi-node strong atomicity remains a deployment concern requiring a suitable external claim backend.

Test coverage:
1. Concurrent claim attempts over shared store produce one winner and one conflict.
