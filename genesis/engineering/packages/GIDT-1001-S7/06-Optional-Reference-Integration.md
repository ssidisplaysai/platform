# 06 Optional Reference Integration

Reservation and allocation flows now validate external request references through the central reference service when provided.

Policy used:
- DOCUMENT reference type
- OPTIONAL validation policy

Rationale:
- Avoids breaking existing flows when optional validators are absent
- Captures audit and metric evidence for missing/invalid optional references
