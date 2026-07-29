# 11 Relationship Authority Classification

## Required Classes
1. AUTHORITATIVE: directly declared by certified source evidence.
2. DERIVED: deterministically produced from authoritative evidence by approved rule.
3. POTENTIAL: may exist but not provable from certified evidence.
4. UNKNOWN: required relationship with insufficient available evidence.

## Classification Rules
1. Potential and unknown relationships shall not be promoted to authoritative.
2. Every derived relationship shall include derivationRuleId.
3. Every authoritative relationship shall include directEvidenceReference.
4. Classification fields shall be machine-readable and query-filterable.

## Required Machine Fields
1. authorityClassification
2. classificationRationale
3. derivationRuleId
4. evidenceReference
5. confidenceClassification
