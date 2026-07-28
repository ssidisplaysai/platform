# Genesis Audit Finding Model

## Finding Classes
- Informational
- Observation
- Recommendation
- Minor Finding
- Major Finding
- Critical Finding
- Constitutional Finding
- Inherited Finding
- Environmental Finding
- False Positive
- Suppressed Finding
- Resolved Finding

## Finding Rules
1. Each finding must declare class, severity, confidence, and traceability links.
2. Inherited findings must be explicitly marked and separated from package-specific findings.
3. False positives and suppressed findings require justification and authority references.
4. Resolved findings require closure evidence and lifecycle transition entries.

## Observation Model
Observations are non-blocking records that do not directly change compliance decisions unless elevated.

## Machine Reference
- [machine/finding-model.json](machine/finding-model.json)
- [machine/observation-model.json](machine/observation-model.json)