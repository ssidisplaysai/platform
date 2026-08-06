# 13 Lot Serial And Expiration Architecture

Lot architecture:

1. Register lot with tenant+product scoped uniqueness.
2. Link lot to balances and movement facts.
3. Support lot-level quantity assignment and transfer constraints.

Serial architecture:

1. Register serial with tenant+product scoped uniqueness.
2. Enforce one active serial location invariant.
3. Movement updates serial location through atomic balance plus serial state transitions.

Expiration architecture:

1. Track manufacture, best-before, and expiration dates by policy.
2. Calculate expiration status deterministically.
3. Transition expired state through explicit command or recovery validation.

Quarantine architecture:

1. QuarantineInventory command transitions stock into non-allocatable hold.
2. ReleaseFromQuarantine requires authority and validation checks.
3. Quarantine status tracked for lot/serial and balance scopes.

Transfer restrictions:

1. Expired stock transfer prohibited unless explicit disposal transfer policy allows.
2. Quarantined stock transfer restricted to approved quarantine movement classes.

Recall linkage:

1. Optional recall reference links allowed where approved and modeled as foreign reference.
2. Recall state does not transfer ownership to inventory; inventory tracks operational restrictions only.

Cycle and duplication prevention:

1. Serial reassignment requires prior location release in same atomic unit.
2. Lot assignment prevents duplicate active lot-state records for same scope and version.
3. Recovery validation detects duplicate serial or lot index corruption and blocks startup when unrecoverable.

Recovery validation:

1. Validate lot and serial uniqueness indexes.
2. Validate one-active-location serial invariant.
3. Validate expiration status recomputation matches persisted status or produce explicit recovery correction process.