# EXP-0001 Customer Derivation

Status: Experimental
Classification: Genesis Semantic Experiment

## Purpose

Test whether the concept Customer can be derived entirely from the five seed primitives without introducing new canonical ontology.

## Observation

Customer appears in most enterprise systems, but its meaning varies by context.
In some contexts Customer is a person, in others an organization, and in others a contractual role.

## Hypothesis

Customer can be modeled as an Actor (derived from Thing) participating in specific Relationships and Events, with Knowledge claims defining verification and status.

## Derivation

Proposed derivation path:
- Thing: identifiable business party.
- Actor: party capable of initiating or receiving business interactions.
- Relationship: party linked to provider through buys_from, contracts_with, or enrolled_in semantics.
- Event: interactions such as order_submitted, subscription_started, payment_received.
- Knowledge: evidence-grounded claims such as verified_identity, active_account, eligibility_status.

Derived Customer candidate definition:
A Customer is an Actor that participates in one or more qualifying commercial Relationships and Events, supported by evidence-grounded Knowledge claims.

## Evidence

Current evidence set:
- Cross-industry data models showing both person and organization customers.
- Contract and transaction records demonstrating relationship and event dependence.
- Compliance workflows requiring evidence-based customer status claims.

Evidence quality assessment:
- strong support for Actor + Relationship + Event composition
- moderate support for universal qualifying relationship set
- incomplete support for globally stable boundary conditions

## Result

Partial success.
The seed concepts are sufficient to express a high-fidelity Customer model candidate.
However, qualifying relationship constraints remain domain-sensitive and not yet universal.

## Lessons Learned

- Seed primitives appear expressive enough for many enterprise concepts.
- Relationship qualification criteria are the most likely source of ambiguity.
- Knowledge claims are essential to avoid overcommitting on static customer identity semantics.

## Next Experiment

EXP-0002 Supplier Derivation:
Attempt derivation using the same seed and compare boundary conditions with Customer.
Focus on whether shared derivation patterns can define reusable relationship qualification rules.
