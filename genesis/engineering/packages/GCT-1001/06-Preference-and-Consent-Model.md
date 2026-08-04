# 06 Preference and Consent Model

## Preferences
- Preferences are append-only versioned records.
- Channel preferences drive eligibility interaction (`PREFERRED`, `ALLOWED`, `DISALLOWED`).

## Consent
- Consent history is append-only with statuses:
  - `GRANTED`
  - `DENIED`
  - `WITHDRAWN`
  - `EXPIRED`
- Capture includes jurisdiction, source, expiration timestamp, evidence reference.
- Transition hardening rejects invalid withdrawal/expiration from non-granted states.

## Eligibility Policy
Eligibility is deterministic from:
- contact lifecycle status
- method availability + validity (+ verification for email/phone)
- consent state and expiration
- preference policy

Notification remains delivery authority; Contact computes fact eligibility only.
