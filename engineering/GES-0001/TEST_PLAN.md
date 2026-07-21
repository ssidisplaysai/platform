# TEST PLAN

## Coverage Goals

The test suite targets construction, validation, serialization, schema generation, and immutability.

## Test Cases

1. Create a valid evidence record and verify the checksum is deterministic.
2. Confirm the returned object and nested collections are frozen.
3. Round-trip a record through JSON serialization and parsing.
4. Reject a tampered checksum during parse.
5. Reject invalid timestamps.
6. Reject duplicate relationship ids.
7. Confirm the generated schema includes the required top-level fields.

## Execution

- Run `npm test` for behavior coverage.
- Run `npm run typecheck` for strict TypeScript validation.
- Run `npm run build` to verify emitted production artifacts compile successfully.