# 08 Parsing Architecture

## Supported Formats
1. Markdown.
2. JSON.
3. YAML only when permitted by Genesis standards and package contracts.

## Parsing Contracts
1. Structured fields parser for key-value contracts.
2. Controlled heading parser for section-scoped extraction.
3. Canonical identifier parser for entity and relationship identity.
4. Declaration parser for explicit ownership, dependency, lifecycle, and authority statements.
5. Prose classifier that distinguishes non-authoritative commentary from structured evidence.

## Extractable Record Types
1. Package manifests.
2. Traceability matrices.
3. Validation and certification records.
4. Release records.
5. Governance decisions.
6. Capability and ownership definitions.

## Failure Behavior
1. Missing required structured fields: error diagnostic; no authoritative extraction.
2. Missing optional fields: warning diagnostic; output marked partial.
3. Unparseable content: error diagnostic with source location and parser stage.
4. Ambiguous declaration: warning or error by policy tier and affected claim type.

## Conflict-Precedence Examples

Example PARSE-EX-001:
1. Inputs: certified JSON ownership field conflicts with markdown prose owner statement.
2. Precedence rule: structured certified declaration overrides prose.
3. Result: JSON declaration selected.
4. Diagnostic severity: WARNING.
5. Compilation behavior: continues.
6. Classification outcome: AUTHORITATIVE when JSON source is admissible.

Example PARSE-EX-002:
1. Inputs: certified manifest conflicts with uncertified metadata file.
2. Precedence rule: higher authority tier prevails.
3. Result: uncertified metadata excluded from authoritative resolution.
4. Diagnostic severity: INFORMATIONAL or WARNING by impact.
5. Compilation behavior: continues.
6. Classification outcome: AUTHORITATIVE from certified source only.

Example PARSE-EX-003:
1. Inputs: CURRENT source conflicts with STALE_NON_BLOCKING source.
2. Precedence rule: CURRENT prevails.
3. Result: stale source retained for lineage only.
4. Diagnostic severity: WARNING.
5. Compilation behavior: continues.
6. Classification outcome: stale-derived assertions downgraded to POTENTIAL.

Example PARSE-EX-004:
1. Inputs: two certified sources with equal authority and conflicting values.
2. Precedence rule: newer certified release, then canonical source identifier order.
3. Result: deterministic winner selected; losing source preserved in diagnostics and lineage.
4. Diagnostic severity: WARNING or ERROR by claim criticality.
5. Compilation behavior: continues for non-critical, blocks critical if unresolved.
6. Classification outcome: AUTHORITATIVE only if deterministic winner exists.

Example PARSE-EX-005:
1. Inputs: explicit declaration conflicts with derived metadata.
2. Precedence rule: explicit admissible declaration prevails over derived metadata.
3. Result: derived value rejected or retained as POTENTIAL context.
4. Diagnostic severity: WARNING.
5. Compilation behavior: continues.
6. Classification outcome: AUTHORITATIVE for explicit declaration.

Example PARSE-EX-006:
1. Inputs: canonical identifier conflict across two admissible entities.
2. Precedence rule: authority precedence and release recency applied.
3. Result: unresolved critical conflict triggers fail-closed behavior.
4. Diagnostic severity: FATAL when both remain authoritative candidates.
5. Compilation behavior: blocked.
6. Classification outcome: BLOCKED.

Example PARSE-EX-007:
1. Inputs: ownership conflict between program registry and package manifest.
2. Precedence rule: constitutional-home ownership rule then explicit certified owner declaration.
3. Result: deterministic owner if resolvable, otherwise unresolved owner state.
4. Diagnostic severity: ERROR.
5. Compilation behavior: continues with degraded output for non-critical scopes, blocks certification/freeze.
6. Classification outcome: CONFLICTED or BLOCKED for critical ownership claims.

Example PARSE-EX-008:
1. Inputs: lifecycle conflict between frozen record and proposed update.
2. Precedence rule: frozen certified lifecycle state prevails.
3. Result: proposed lifecycle excluded from current-state authoritative graph.
4. Diagnostic severity: ERROR.
5. Compilation behavior: continues with diagnostics; authoritative override prohibited.
6. Classification outcome: AUTHORITATIVE from frozen record.

Example PARSE-EX-009:
1. Inputs: version conflict between equal-tier certified records.
2. Precedence rule: certified release selection policy.
3. Result: deterministic selection; alternate version retained as superseded lineage.
4. Diagnostic severity: INFORMATIONAL or WARNING.
5. Compilation behavior: continues.
6. Classification outcome: DERIVED lineage edges, AUTHORITATIVE current-state edge.

Example PARSE-EX-010:
1. Inputs: missing required structured field, equivalent value appears only in prose.
2. Precedence rule: prose-only value cannot satisfy required structured contract for authoritative claim.
3. Result: field unresolved.
4. Diagnostic severity: ERROR.
5. Compilation behavior: continues for non-critical query/navigation contexts; blocks affected authoritative output.
6. Classification outcome: UNKNOWN or BLOCKED by claim criticality.
