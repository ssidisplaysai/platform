# ADR-0019: Genesis Enterprise Decision Engine v1

**Status:** Implemented  
**Date:** 2026-07-08  
**Version:** 1.0

## Overview

The Genesis Enterprise Decision Engine v1 is a metadata-driven decision evaluation system that ranks competing enterprise plans and recommends the optimal course of action. Unlike traditional decision systems that rely on hardcoded heuristics or AI black boxes, this engine operates entirely on transparent, criteria-based evaluation with full reasoning transparency.

### Core Purpose

Evaluate multiple enterprise plans across 9 key business criteria and provide transparent, defensible recommendations.

**Supported Evaluation Criteria:**
- Cost: Total implementation and operational cost
- Revenue: Revenue impact and growth potential
- Profitability: Profit margin and return on investment
- Schedule: Time to implementation and value delivery
- Resource: Resource utilization and efficiency
- Customer: Customer satisfaction and impact
- Operational: Operational risk and complexity
- Strategic: Strategic alignment with business goals
- Compliance: Policy and regulatory compliance

## Architecture

### Component Structure

```
Decision Engine Architecture
┌─────────────────────────────────────────┐
│      Enterprise Decision Evaluation     │
├─────────────────────────────────────────┤
│  Input: Competing Enterprise Plans      │
│  ├─ Planning Engine Output              │
│  ├─ Simulation Results                  │
│  ├─ Business Metadata                   │
│  ├─ Policies & Constraints              │
│  └─ Tenant Configuration                │
├─────────────────────────────────────────┤
│  Metadata-Driven Evaluation             │
│  ├─ Criteria Weighting                  │
│  ├─ Score Normalization                 │
│  ├─ Constraint Checking                 │
│  ├─ Alternative Ranking                 │
│  └─ Tradeoff Analysis                   │
├─────────────────────────────────────────┤
│  Decision Generation (8-Stage Pipeline) │
│  1. Initialize Blueprint                │
│  2. Load Context & Criteria             │
│  3. Load Options                        │
│  4. Evaluate Against Criteria           │
│  5. Check Constraints                   │
│  6. Rank Alternatives                   │
│  7. Generate Explanation                │
│  8. Create Recommendation               │
├─────────────────────────────────────────┤
│  Output: Transparent Decision           │
│  ├─ Ranked Alternatives                 │
│  ├─ Weighted Scores                     │
│  ├─ Reasoning & Rationale              │
│  ├─ Tradeoff Analysis                   │
│  ├─ Risk Assessment                     │
│  └─ Implementation Plan                 │
└─────────────────────────────────────────┘
```

### Key Contracts

#### DecisionCriteria
Represents an evaluation criterion with weight and direction.
- **Properties:** name, type (9 types), weight (0-1), direction (lower/higher)
- **Methods:** validate(), isSatisfied(), getSummary(), toJSON()

#### DecisionConstraint
Represents hard or soft constraints on decisions.
- **Properties:** name, type (hard/soft), criteria, operator (<=, >=, ==, !=), threshold
- **Methods:** validate(), isSatisfied(), getSummary(), toJSON()

#### DecisionOption
Represents an alternative plan to evaluate.
- **Properties:** name, cost, revenue, profitability, schedule, resourceUtilization, etc.
- **Properties:** simulationResults, metrics, assumptions, risks
- **Methods:** getMetricValue(), getAllMetrics(), markSelected(), markRejected()

#### DecisionScore
Contains scoring results for an option against criteria.
- **Properties:** optionId, criteriaScores[], totalScore, normalizedScore (0-100), rank
- **Properties:** constraintStatus[], constraintViolations[], breakdownByType
- **Methods:** recordCriteriaScore(), recordConstraintStatus(), hasViolations()

#### DecisionExplanation
Explains the decision reasoning.
- **Properties:** summary, rationale[], strengths[], weaknesses[], tradeoffs[], risks[]
- **Properties:** assumptions[], nextSteps[], confidence (0-100)
- **Methods:** addRationale(), addStrength(), addWeakness(), addTradeoff()

#### DecisionRecommendation
Represents the recommended action.
- **Properties:** recommendedOptionId, priority, confidence, expectedOutcome, timeline
- **Properties:** dependencies[], successCriteria[], status (draft/approved/executing/completed)
- **Methods:** markApproved(), markExecuting(), markCompleted()

#### DecisionContext
Contains evaluation context (tenant, criteria, constraints).
- **Properties:** tenantId, decisionType (enterprise/departmental/module), criteria[], constraints[]
- **Properties:** businessObjective, decisionHorizon, executionMode, policies[]
- **Methods:** validate(), markActive(), markCompleted()

#### EnterpriseDecision
Main decision contract.
- **Properties:** name, businessObjective, options[], scores[], selectedOption, recommendation
- **Properties:** explanation, status, version, metadata
- **Methods:** validate(), markValidated(), markEvaluated(), markDecided(), markApproved()

### 8-Stage Evaluation Pipeline

#### Stage 1: Initialize Blueprint
- Create EnterpriseDecision
- Set business objective and context
- Mark as validated

#### Stage 2: Load Context & Criteria
- Create DecisionContext with tenant information
- Load or create default evaluation criteria (9 types)
- Load or create default constraints (budget, timeline, compliance)
- Configure policies and decision parameters

#### Stage 3: Load Options
- Load competing enterprise plans
- Extract plan details from Planning Engine output
- Attach simulation results
- Record metrics and assumptions

#### Stage 4: Evaluate Against Criteria
- Calculate normalized score for each option-criteria pair
  - Cost normalization: lower is better (inverse scoring)
  - Revenue/Profitability: higher is better (direct scoring)
  - Schedule: lower (faster) is better (inverse scoring)
  - Operational Risk: lower is better (inverse scoring)
- Apply criteria weights (0-1)
- Calculate weighted total score per option
- Group scores by criteria type

#### Stage 5: Check Constraints
- Validate each option against all constraints
- Categorize constraints as hard (mandatory) or soft (preferential)
- Mark constraint status (satisfied/violated)
- Penalize or exclude based on violation type

#### Stage 6: Rank Alternatives
- Sort options by normalized score (0-100)
- Assign rankings (1st, 2nd, 3rd...)
- Select best-ranking option (if no hard violations)
- Create ranked list for comparison

#### Stage 7: Generate Explanation
- Create summary of decision reasoning
- Document rationale for selection
- Identify strengths and weaknesses of selected option
- Analyze tradeoffs vs. alternatives
- List risk factors and assumptions
- Calculate confidence score (based on score margin)
- Generate next steps

#### Stage 8: Create Recommendation
- Create actionable recommendation
- Set priority based on score (>85 = critical, else high)
- Define implementation approach
- Establish timeline and dependencies
- Define success criteria
- Mark as approved

## Metadata-Driven Evaluation

### No Hardcoded Decision Logic

The engine evaluates plans purely on structured criteria:

```javascript
// NOT: if (cost > 500000) { reject(); }
// INSTEAD:
const constraint = new DecisionConstraint({
  type: 'hard',
  operator: '<=',
  threshold: 500000
});
const satisfied = constraint.isSatisfied(option.cost);
```

### Transparent Scoring

Each score is decomposed and explained:

```javascript
{
  "optionId": "opt-2",
  "criteriaScores": {
    "crit-cost": 65,        // Lower cost scoring
    "crit-revenue": 78,     // Higher revenue scoring
    "crit-profitability": 82,
    // ... more
  },
  "breakdownByType": {
    "cost": 65,
    "revenue": 78,
    "profitability": 82,
    // ... by type summaries
  },
  "normalizedScore": 75,    // 0-100
  "rank": 1,
  "violations": []
}
```

### Normalization Strategy

Different criteria require different normalization:

**Inverse Scoring (Lower is Better):**
- Cost: `100 - (value / 10000)`
- Schedule: `100 - (value / 2)`
- Operational Risk: `100 - value`

**Direct Scoring (Higher is Better):**
- Revenue, Profitability: Direct value (capped at 100)
- Resource Utilization, Customer Impact: Direct value
- Strategic Alignment, Compliance: Direct value

## Decision Evaluation

### 9 Evaluation Criteria

| Criterion | Type | Direction | Weight | Description |
|-----------|------|-----------|--------|-------------|
| Cost | Financial | Lower | 20% | Total implementation cost |
| Revenue | Financial | Higher | 20% | Revenue impact |
| Profitability | Financial | Higher | 15% | Profit margin impact |
| Schedule | Timeline | Lower | 10% | Time to implementation |
| Resource | Operational | Higher | 10% | Resource efficiency |
| Customer | Market | Higher | 10% | Customer impact |
| Operational | Risk | Lower | 10% | Operational risk |
| Strategic | Strategic | Higher | 10% | Strategic alignment |
| Compliance | Governance | Higher | 5% | Policy compliance |

### Default Constraints

**Hard Constraints (Must Satisfy):**
- Budget Constraint: Cost <= $500,000
- Timeline Constraint: Schedule <= 180 days
- Compliance Requirement: Compliance Score >= 80%

**Soft Constraints (Preferential):**
- Profitability minimum: >= 25%
- Resource efficiency: >= 60%

## CLI Integration

### Command: decide enterprise

```bash
# Evaluate enterprise decision
node tools/genesis/genesis.mjs decide enterprise

# With custom options
node tools/genesis/genesis.mjs decide evaluate --tenant=corp-001
node tools/genesis/genesis.mjs decide compare --verbose

# Show recommendation
node tools/genesis/genesis.mjs decide recommend --objective="Maximize revenue"

# Help
node tools/genesis/genesis.mjs decide --help
```

### Options
- `--tenant <id>` - Specify tenant (default: 'default')
- `--domain <domain>` - Specify decision domain
- `--objective <text>` - Business objective
- `--criteria <n>` - Number of evaluation criteria
- `--options <n>` - Number of options to compare
- `--dry-run` - Analysis mode only
- `--verbose, -v` - Show detailed output
- `--help, -h` - Show help

## API Usage

```javascript
import { DecisionEngine } from './tools/genesis/compiler/DecisionEngine.mjs';

const engine = new DecisionEngine();

const result = await engine.executeDecision({
  name: 'Strategic Initiative Decision',
  businessObjective: 'Optimize for revenue and timeline',
  options: [...],  // DecisionOption[]
  context: {
    tenantId: 'corp-001',
    criteria: [...],     // Optional custom criteria
    constraints: [...]   // Optional custom constraints
  }
});

// Access results
const decision = engine.decision;        // EnterpriseDecision
const selectedOption = decision.selectedOption;
const recommendation = decision.recommendation;
const explanation = decision.explanation;
```

## Artifact Outputs

**5 JSON Files Per Decision:**

1. **decision-blueprint.json** - Complete decision with all options
2. **decision-context.json** - Evaluation context and criteria
3. **decision-scores.json** - Scoring details for each option
4. **decision-explanation.json** - Reasoning and tradeoff analysis
5. **decision-recommendation.json** - Final recommendation and action plan
6. **decision-full.json** - Complete decision with all data

## Testing

### Test Coverage
- 40+ comprehensive unit tests
- Contract initialization and validation
- Scoring algorithm verification
- Constraint evaluation
- Ranking logic
- End-to-end decision scenarios

### Test Categories
1. **Criteria Tests** (3 tests)
2. **Constraint Tests** (3 tests)
3. **Option Tests** (3 tests)
4. **Score Tests** (3 tests)
5. **Explanation Tests** (4 tests)
6. **Recommendation Tests** (2 tests)
7. **Context Tests** (3 tests)
8. **Decision Tests** (5 tests)
9. **Engine Tests** (8 tests)
10. **Integration Tests** (5 tests)

## Safety Guarantees

### Deterministic Results
- Same options + same criteria = same recommendation
- Repeatable execution
- Transparent scoring at every step
- Complete audit trail

### Read-Only Analysis
- No modifications to source systems
- Reads from planning/simulation outputs only
- Non-destructive evaluation

### Tenant Isolation
- Per-tenant decision evaluation
- No cross-tenant data leakage
- Isolated artifact storage

## Scoring Algorithm

### Score Calculation

```
For each criterion:
  1. Get option's metric value
  2. Normalize to 0-100 based on direction
  3. Apply weight
  4. Sum weighted scores
  
Total Score = Σ(Normalized Score × Weight) / Σ(Weights)
Confidence = 75% + Score Margin (to nearest competitor)
```

### Example: 3-Option Evaluation

```
Option A:
  Cost (weight 0.20):        60/100 × 0.20 = 12
  Revenue (weight 0.20):     75/100 × 0.20 = 15
  Profitability (weight 0.15): 70/100 × 0.15 = 10.5
  Schedule (weight 0.10):    65/100 × 0.10 = 6.5
  ... (continue for all criteria)
  
  Weighted Total: 72/100
  Rank: 1
  
Option B: 65/100 (Rank 2)
Option C: 58/100 (Rank 3)

Recommendation Confidence: 75% + (72-65)/100 = 82%
```

## Performance Characteristics

### Complexity Analysis
- Time: O(n × m) where n = options, m = criteria
- Space: O(n × m) for score matrix
- Typical execution: < 1 second for 10 options and 9 criteria

### Scaling
- Handles unlimited options
- Supports dynamic criteria (1-20+)
- Supports dynamic constraints (1-20+)

## Integration Points

### Depends On
- **Planning Engine** (Phase 14) - Generates options
- **Simulation Engine** (Phase 13) - Provides impact analysis
- **Digital Twin** (Phase 12) - Business metadata
- **Identity Platform** (Phase 11) - Tenant scoping

### Provides To
- **CLI Framework** - decide command
- **Artifact Storage** - Decision records
- **Audit Trail** - Decision rationale
- **Stakeholder Reports** - Decision explanation

## Future Enhancements

1. **Multi-Stakeholder Evaluation**
   - Different criteria weights per stakeholder
   - Consensus building
   - Voting mechanisms

2. **Machine Learning Integration**
   - Learn from past decisions
   - Refine scoring over time
   - Predict decision outcomes

3. **Real-Time Monitoring**
   - Track implemented decision outcomes
   - Compare to projections
   - Adjust recommendations

4. **Sensitivity Analysis**
   - Show how decisions change with different weights
   - Identify critical factors
   - What-if analysis

5. **Risk Quantification**
   - Probabilistic scoring
   - Scenario analysis
   - Monte Carlo simulation

## References

- Phase 12: Enterprise Digital Twin
- Phase 13: Enterprise Simulation Engine
- Phase 14: Enterprise Planning Engine
- ADR-0004: Domain Model
- ADR-0018: Enterprise Planning Engine

## Appendix: Example Decision Output

```json
{
  "decision": {
    "id": "dec-a1b2c3d4",
    "name": "Strategic Initiative Decision",
    "status": "decided",
    "options": 3,
    "selectedOption": "Balanced Approach",
    "recommendationConfidence": 87,
    "scores": [
      {
        "optionId": "opt-2",
        "normalizedScore": 78,
        "rank": 1,
        "breakdownByType": {
          "cost": 70,
          "revenue": 80,
          "profitability": 82,
          "schedule": 75,
          "compliance": 85
        },
        "violations": 0
      }
    ],
    "recommendation": {
      "recommendedOptionId": "opt-2",
      "priority": "high",
      "confidence": 87,
      "expectedOutcome": "Achieve 35% revenue growth within 120 days",
      "timeline": "120 days for full implementation",
      "successCriteria": [
        "Achieve 35% revenue impact",
        "Complete within 120 days",
        "Maintain 85% compliance",
        "Achieve 80% customer satisfaction"
      ]
    },
    "explanation": {
      "summary": "Selected 'Balanced Approach' based on weighted evaluation of 9 key criteria.",
      "rationale": [
        "Highest weighted score: 78/100",
        "Optimal cost-benefit ratio",
        "Acceptable implementation timeline",
        "Strong strategic alignment"
      ],
      "strengths": [
        "Strong revenue: 35%",
        "Strong compliance: 85%",
        "Strong customer impact: 80%"
      ],
      "tradeoffs": [
        "vs Conservative: Higher risk but faster delivery",
        "vs Aggressive: Lower cost but slower revenue"
      ],
      "riskFactors": [
        "Medium resource demands",
        "Moderate coordination complexity"
      ],
      "nextSteps": [
        "Review recommendation with stakeholders",
        "Approve implementation plan",
        "Allocate resources",
        "Execute phased rollout",
        "Monitor metrics and adjust"
      ],
      "confidence": 87
    }
  }
}
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-08  
**Author:** Genesis Architecture Team  
**Status:** Final
