# 16 Risk Register

## Active Risks
1. Repository scope contamination risk
- Evidence: 146 changed entries across core domains
- Impact: accidental inclusion of unrelated work
- Severity: CRITICAL

2. Upstream divergence risk
- Evidence: branch behind upstream by 3 commits
- Impact: non-fast-forward or history confusion
- Severity: HIGH

3. Validation gate failure risk
- Evidence: lint/test/build/typecheck failures in baseline matrix
- Impact: unstable baseline commit
- Severity: HIGH

4. False-positive conflict marker noise
- Evidence: separator lines matched token scans
- Impact: reviewer confusion if not manually interpreted
- Severity: MEDIUM

5. Dependency script approval warning
- Evidence: npm ci --dry-run warning for install scripts
- Impact: policy non-compliance if unreviewed
- Severity: MEDIUM