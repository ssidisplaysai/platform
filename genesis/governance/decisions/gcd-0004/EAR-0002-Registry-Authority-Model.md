# EAR-0002 Registry Authority Model

Artifact ID: EAR-0002
Decision Parent: GCD-0004
Status: CERTIFIED
Lifecycle State: Published
Authority: Genesis Architecture and Runtime Authority

## Purpose

Define constitutional authority ownership and mutation rights for Enterprise Application Registry records.

## Authority Ownership Rules

1. Exactly one constitutional authority owner SHALL govern the registry.
2. Authority owner default: Genesis Architecture and Runtime Authority.
3. Delegation is allowed only through explicit governed delegation records.
4. Delegation SHALL NOT create parallel authority owners.

## Mutation Authority Rules

Create entry:
- Allowed actors: delegated registry stewards.
- Required approval: authority owner or delegated approval authority.

Modify entry:
- Allowed actors: delegated registry stewards.
- Required approval: rule-based approval by lifecycle state and mutation class.

Retire entry:
- Allowed actors: authority owner or delegated retirement authority.
- Required approval: retirement approval record and audit event.

Version updates:
- Allowed actors: delegated registry stewards for application lifecycle governance.
- Required approval: compatibility validation pass.

Ownership transfer:
- Allowed actors: authority owner only.
- Required approval: explicit transfer approval record.

Capability changes:
- Allowed actors: delegated stewards.
- Required approval: capability ownership and dependency validation.

Navigation metadata changes:
- Allowed actors: delegated stewards.
- Required approval: visibility and launch policy validation.

## Prohibited Authority Actions

1. No actor may mutate records without audit emission.
2. No actor may bypass lifecycle transition rules.
3. No actor may assign multiple authority owners to one record.
4. Runtime services SHALL NOT become constitutional authority owners.
