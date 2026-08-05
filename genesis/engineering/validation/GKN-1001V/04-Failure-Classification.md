# 04 Failure Classification

Classification rubric:

- PASS
- BASELINE ISSUE
- GKN-1001 REGRESSION
- UNKNOWN

Issue classification:

1. Targeted Knowledge tests
- Classification: PASS

2. Mission Control knowledge observability tests
- Classification: PASS

3. Repository-wide typecheck: src/lib/glw/job-repository.ts
- Classification: BASELINE ISSUE
- Basis: file not modified by GKN-1001; identical parent/commit blob.

4. Repository-wide typecheck: src/lib/glw/jobs.ts
- Classification: BASELINE ISSUE
- Basis: file not modified by GKN-1001; identical parent/commit blob.

5. Repository-wide typecheck: src/lib/glw/prisma.ts
- Classification: BASELINE ISSUE
- Basis: file not modified by GKN-1001; identical parent/commit blob.

6. Repository-wide typecheck: src/platform/gop/persistence/prisma-event-store.ts
- Classification: BASELINE ISSUE
- Basis: file not modified by GKN-1001; identical parent/commit blob.

7. Repository-wide typecheck: src/platform/gop/runtime/prisma.ts
- Classification: BASELINE ISSUE
- Basis: file not modified by GKN-1001; identical parent/commit blob.

Regression summary:

- GKN-1001 REGRESSION: NONE
- UNKNOWN: NONE
