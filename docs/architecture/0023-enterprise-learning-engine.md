# 0023-enterprise-learning-engine.md

## Genesis Enterprise Learning Engine v1 Architecture

**Status:** Implemented & Tested  
**Phase:** 19 - Enterprise Learning  
**Last Updated:** 2026-07-08  
**Test Coverage:** 30+ tests, 100% passing  

---

## Overview

The Genesis Enterprise Learning Engine v1 enables the platform to continuously capture and analyze enterprise execution outcomes without embedding business-specific logic. It generates reusable organizational knowledge that improves planning, decision-making, and AI orchestration over time.

### Key Features

- **Metadata-Driven Learning**: Configurable domains, no hardcoded business logic
- **Multi-Source Observation Capture**: Runtime, events, workflows, automations, planning, decisions, simulations, AI
- **7-Stage Learning Pipeline**: Observation → Signal → Metric → Pattern → Hypothesis → Insight → Recommendation
- **Comparison Analysis**: Planned vs Actual, Simulated vs Actual, Predicted vs Actual, Decision vs Outcome
- **Confidence Tracking**: All outputs include confidence scores
- **Reusable Insights**: Knowledge generated across enterprises
- **Evidence Tracing**: Full attribution chain from observations to insights
- **Extensible Design**: New learning domains and signals supported

---

## Learning Architecture

### Eight Learning Domains

The Learning Engine operates across eight configurable domains:

1. **Operations** - Operational efficiency and process metrics
2. **Manufacturing** - Production and quality management
3. **Inventory** - Stock and inventory optimization
4. **Purchasing** - Procurement and supplier performance
5. **Sales** - Sales performance and pipeline
6. **Finance** - Financial metrics and cost optimization
7. **Customer Service** - Customer satisfaction and service metrics
8. **AI Performance** - AI model accuracy and effectiveness

Each domain captures and analyzes domain-specific patterns while using the same deterministic pipeline.

---

## Learning Contracts

### 8 Core Contracts

#### 1. **LearningObservation** - Raw Facts

```typescript
class LearningObservation {
  id: string                      // Deterministic ID
  source: string                  // "runtime" | "event" | "workflow" | "automation" | "planning" | "decision" | "simulation" | "ai"
  domain: string                  // Learning domain
  type: string                    // "event" | "metric" | "outcome" | "anomaly"
  value: any                      // Observed value
  timestamp: string               // When observed
  context: object                 // Additional context
  metadata: object                // Tracing metadata
  confidence: number              // 0-1 confidence level
  tags: string[]                  // Classification tags
  status: string                  // draft → defined → validated → approved
  createdAt: string
}
```

**Purpose**: Capture raw facts from execution sources without interpretation.

#### 2. **LearningSignal** - Meaningful Events/Anomalies

```typescript
class LearningSignal {
  id: string
  type: string                    // "anomaly" | "trend" | "threshold" | "pattern" | "correlation"
  domain: string
  severity: string                // "info" | "warning" | "critical"
  observation: string             // Reference to LearningObservation
  description: string
  threshold: number               // Trigger threshold if applicable
  actual: number                  // Observed value
  expected: number                // Expected baseline
  deviation: number               // Deviation magnitude
  correlations: string[]          // Related signal IDs
  confidence: number              // 0-1
  status: string
}
```

**Purpose**: Detect meaningful events, anomalies, and interesting patterns in observations.

#### 3. **LearningMetric** - Measurable Performance Data

```typescript
class LearningMetric {
  id: string
  name: string                    // "throughput", "latency", "accuracy", etc.
  domain: string
  category: string                // "performance" | "quality" | "efficiency" | "cost" | "risk"
  value: number
  unit: string                    // "ms", "$", "%", etc.
  baseline: number                // Historical baseline
  target: number                  // Target value
  trend: string                   // "improving" | "declining" | "stable" | "volatile"
  period: string                  // "1h", "1d", "1w"
  timestamp: string
  status: string
}
```

**Purpose**: Track performance metrics with baselines and targets for comparison.

#### 4. **LearningPattern** - Recurring Behaviors

```typescript
class LearningPattern {
  id: string
  name: string
  domain: string
  patternType: string             // "sequential" | "recurring" | "seasonal" | "cyclical"
  description: string
  observations: string[]          // IDs of observations forming pattern
  frequency: number               // 0-1, how often observed
  duration: string                // Typical duration
  conditions: string[]            // Preconditions
  consequences: string[]          // Typical outcomes
  confidence: number              // 0-1
  occurrences: number
  firstSeen: string
  lastSeen: string
  status: string
}
```

**Purpose**: Identify recurring behaviors and cycles in execution.

#### 5. **LearningHypothesis** - Theories About Causation

```typescript
class LearningHypothesis {
  id: string
  statement: string               // The hypothesis statement
  domain: string
  causation: object[]             // [{cause, effect, strength}, ...]
  correlations: string[]          // Related metrics/signals
  confidence: number              // 0-1
  evidenceFor: string[]           // Supporting observation IDs
  evidenceAgainst: string[]       // Contradicting observation IDs
  testable: boolean               // Can this be tested?
  status: string                  // draft → tested → validated → approved
}
```

**Purpose**: Generate theories about cause-and-effect relationships with evidence.

#### 6. **LearningInsight** - Validated Knowledge (Reusable)

```typescript
class LearningInsight {
  id: string
  title: string
  domain: string
  description: string
  type: string                    // "performance" | "efficiency" | "risk" | "opportunity"
  source: string[]                // IDs of observations/patterns/hypotheses
  impact: string                  // "low" | "medium" | "high" | "critical"
  confidence: number              // 0-1
  applicability: string[]         // Industries/domains where applicable
  conditions: string[]            // When this insight applies
  relatedInsights: string[]       // Related insight IDs
  reusable: boolean               // Can be applied to other enterprises
  status: string                  // draft → defined → validated → approved
  approvedAt: string
}
```

**Purpose**: Create reusable, enterprise-agnostic knowledge that can improve other organizations.

#### 7. **LearningRecommendation** - Actionable Suggestions

```typescript
class LearningRecommendation {
  id: string
  title: string
  insight: string                 // Reference to LearningInsight
  domain: string
  description: string
  action: string                  // Specific action to take
  priority: string                // "low" | "medium" | "high" | "critical"
  expectedBenefit: string         // e.g., "15% improvement"
  effort: string                  // "low" | "medium" | "high"
  riskLevel: string               // "low" | "medium" | "high"
  implementationSteps: string[]
  metrics: string[]               // Success metrics
  targetDate: string
  status: string                  // draft → proposed → approved → implemented
}
```

**Purpose**: Provide specific, actionable recommendations based on insights.

#### 8. **LearningSnapshot** - Time-Scoped Collection

```typescript
class LearningSnapshot {
  id: string
  period: string                  // "1h" | "1d" | "1w" | "1mo"
  timestamp: string
  observations: LearningObservation[]
  signals: LearningSignal[]
  metrics: LearningMetric[]
  patterns: LearningPattern[]
  hypotheses: LearningHypothesis[]
  insights: LearningInsight[]
  recommendations: LearningRecommendation[]
  domains: string[]
  comparisons: object             // Comparison results
  metrics_summary: object
  status: string
}
```

**Purpose**: Collect all learning components for a time period (hourly, daily, etc.).

---

## Learning Pipeline

The Learning Engine implements a **7-stage deterministic pipeline**:

```
Stage 1: Capture Observations
    ↓
Stage 2: Detect Signals
    ↓
Stage 3: Collect Metrics
    ↓
Stage 4: Identify Patterns
    ↓
Stage 5: Generate Hypotheses
    ↓
Stage 6: Create Insights
    ↓
Stage 7: Generate Recommendations
```

### Stage 1: Capture Observations

**Inputs**: Raw execution data from multiple sources  
**Outputs**: LearningObservation[] array

Captures raw facts from:
- Runtime execution (actual service behavior)
- Events (system and business events)
- Workflows (process execution)
- Automations (automation outcomes)
- Planning (plan execution vs actual)
- Decisions (decision outcomes)
- Simulations (simulation results)
- AI (AI model outputs and predictions)

Each observation includes:
- Source and domain
- Observed value
- Timestamp and context
- Confidence score
- Tracing metadata

### Stage 2: Detect Signals

**Inputs**: Observations  
**Outputs**: LearningSignal[] array

Detects meaningful events:
- **Anomalies**: Unusual values or patterns
- **Trends**: Consistent increases or decreases
- **Thresholds**: Values exceeding limits
- **Patterns**: Interesting combinations
- **Correlations**: Related observations

Each signal includes:
- Actual vs expected values
- Deviation magnitude
- Severity (info/warning/critical)
- Related signals and observations

### Stage 3: Collect Metrics

**Inputs**: Observations  
**Outputs**: LearningMetric[] array

Tracks performance metrics:
- Baseline (historical average)
- Current value
- Target (desired state)
- Trend (direction of change)
- Category (performance, quality, efficiency, cost, risk)

Enables comparison of performance over time.

### Stage 4: Identify Patterns

**Inputs**: Observations  
**Outputs**: LearningPattern[] array

Recognizes recurring behaviors:
- Sequential patterns (step-by-step)
- Recurring patterns (repeats)
- Seasonal patterns (time-based)
- Cyclical patterns (periodic)

Each pattern includes:
- Preconditions and consequences
- Frequency and duration
- Evidence (observation IDs)
- Confidence score

### Stage 5: Generate Hypotheses

**Inputs**: Observations, Patterns, Metrics  
**Outputs**: LearningHypothesis[] array

Creates theories about causation:
- Causation chains (cause → effect)
- Correlations (related metrics)
- Evidence supporting/contradicting
- Testability assessment

Example: "High order volume (cause) typically leads to increased inventory demand (effect) because..."

### Stage 6: Create Insights

**Inputs**: Patterns, Hypotheses, Observations  
**Outputs**: LearningInsight[] array

Validates and generalizes knowledge:
- Combines multiple evidence sources
- Assesses applicability across domains
- Determines reusability
- Assigns confidence and impact
- Traces back to evidence

Insights become reusable knowledge available to other enterprises.

### Stage 7: Generate Recommendations

**Inputs**: Insights  
**Outputs**: LearningRecommendation[] array

Creates specific action items:
- References source insight
- Specifies concrete action
- Assesses effort and risk
- Identifies success metrics
- Provides implementation steps
- Sets target date

Recommendations can be:
- Proposed (needs approval)
- Approved (ready for implementation)
- Implemented (completed)

---

## Comparison Framework

The Learning Engine compares execution to expectations:

### 1. Planned vs Actual

```typescript
plannedVsActual = {
  metric: string              // Metric name
  domain: string              // Domain
  planned: number             // Plan value
  actual: number              // Actual value
  variance: number            // Absolute difference
  variancePercent: number     // Percentage variance
}
```

**Purpose**: Track plan adherence and identify deviations.

### 2. Simulated vs Actual

```typescript
simulatedVsActual = {
  metric: string
  domain: string
  simulated: number           // Simulation predicted
  actual: number              // Actual outcome
  variance: number
  accuracy: number            // 0-100% accuracy
}
```

**Purpose**: Evaluate simulation model accuracy for improvement.

### 3. Predicted vs Actual

```typescript
predictedVsActual = {
  signal: string              // Signal type
  domain: string
  predicted: number           // Prediction
  actual: number              // Actual value
  deviation: number           // Prediction error
}
```

**Purpose**: Track prediction accuracy for AI models.

### 4. Decision vs Outcome

```typescript
decisionVsOutcome = {
  decision: string            // Decision ID
  expectedOutcome: number     // Expected result
  actualOutcome: number       // Actual result
  successRate: number         // 0-100% success
}
```

**Purpose**: Measure decision effectiveness for improvement.

---

## Learning Result Contract

```typescript
class LearningResult {
  id: string
  observations: LearningObservation[]
  signals: LearningSignal[]
  metrics: LearningMetric[]
  patterns: LearningPattern[]
  hypotheses: LearningHypothesis[]
  insights: LearningInsight[]
  recommendations: LearningRecommendation[]
  snapshots: LearningSnapshot[]
  comparisons: {
    plannedVsActual: object[]
    simulatedVsActual: object[]
    predictedVsActual: object[]
    decisionVsOutcome: object[]
  }
  status: string              // "draft" | "success" | "partial" | "failed"
  validationErrors: object[]
  validationWarnings: object[]
  metrics_data: object
  createdAt: string
}
```

---

## CLI Commands

### Analyze Execution Outcomes

```bash
node tools/genesis/genesis.mjs learn analyze
node tools/genesis/genesis.mjs learn analyze --verbose
```

Runs the full 7-stage learning pipeline and persists artifacts.

**Output**:
```
Learning Session ID: result-a1b2c3
Observations: 64
Signals: 19
Patterns: 16
Insights: 8
Recommendations: 5
```

### Generate Learning Report

```bash
node tools/genesis/genesis.mjs learn report
node tools/genesis/genesis.mjs learn report --format=detailed
```

Generates comprehensive learning report with insights and recommendations.

### List Insights

```bash
node tools/genesis/genesis.mjs learn insights
node tools/genesis/genesis.mjs learn insights --domain=sales
```

Lists all generated insights, optionally filtered by domain.

### List Recommendations

```bash
node tools/genesis/genesis.mjs learn recommendations
node tools/genesis/genesis.mjs learn recommendations --priority=high
```

Lists recommendations, optionally filtered by priority.

### Show Patterns

```bash
node tools/genesis/genesis.mjs learn patterns
node tools/genesis/genesis.mjs learn patterns --domain=manufacturing
```

Displays identified patterns, optionally by domain.

### Show Signals

```bash
node tools/genesis/genesis.mjs learn signals
node tools/genesis/genesis.mjs learn signals --severity=critical
```

Shows detected signals, optionally filtered by severity.

### Check Status

```bash
node tools/genesis/genesis.mjs learn status
node tools/genesis/genesis.mjs learn status --verbose
```

Shows Learning Engine operational status and capabilities.

---

## Artifact Persistence

Learning artifacts are persisted to: `out/generated/learning/analysis-{DATE}/`

**Files created**:
- `observations.json` - Raw captured facts
- `signals.json` - Detected signals
- `metrics.json` - Performance metrics
- `patterns.json` - Identified patterns
- `hypotheses.json` - Generated hypotheses
- `insights.json` - Validated insights
- `recommendations.json` - Action recommendations
- `comparisons.json` - Comparison analysis
- `learning-metadata.json` - Summary and metrics

---

## Integration with Other Engines

### Digital Twin Integration

Learning Engine provides:
- Historical execution patterns
- Performance baselines and trends
- Typical outcomes for scenarios
- Context for simulation

```
Digital Twin uses Learning insights to:
  ✓ Set accurate initial conditions
  ✓ Calibrate behavior models
  ✓ Predict more realistic outcomes
```

### Planning Engine Integration

Learning Engine provides:
- Historical plan accuracy
- Domain-specific patterns
- Risk indicators
- Resource utilization patterns

```
Planning Engine uses Learning insights to:
  ✓ Adjust planning parameters
  ✓ Improve resource estimation
  ✓ Better schedule activities
  ✓ Reduce planning variance
```

### Decision Engine Integration

Learning Engine provides:
- Decision outcome analysis
- Option effectiveness data
- Risk assessment data
- Constraint violation patterns

```
Decision Engine uses Learning insights to:
  ✓ Score options more accurately
  ✓ Better assess constraints
  ✓ Improve recommendations
  ✓ Learn from past decisions
```

### AI Orchestrator Integration

Learning Engine provides:
- Model prediction accuracy data
- Performance trends
- Confidence score patterns
- Optimization opportunities

```
AI Orchestrator uses Learning insights to:
  ✓ Select better models
  ✓ Improve prompt engineering
  ✓ Tune model parameters
  ✓ Detect model degradation
```

---

## Metadata-Driven Design

The Learning Engine is fully metadata-driven:

### Configurable Learning Domains

Add new domains without code changes:
```typescript
const domains = [
  'operations', 'manufacturing', 'inventory', 'purchasing',
  'sales', 'finance', 'customer_service', 'ai_performance',
  // Add more domains here
];
```

### Configurable Signal Types

```typescript
const signalTypes = [
  'anomaly', 'trend', 'threshold', 'pattern', 'correlation'
  // Add more signal detection types
];
```

### Configurable Metric Categories

```typescript
const categories = [
  'performance', 'quality', 'efficiency', 'cost', 'risk'
  // Add more metric categories
];
```

### No Business Logic Embedded

All logic is generic and domain-agnostic:
- Observation capture is source-based, not business-based
- Signal detection uses statistical methods
- Pattern recognition is algorithmic, not heuristic
- Insight generation is evidence-based
- Recommendations are prioritized by impact/effort

---

## Confidence and Traceability

### Confidence Scores

All outputs include 0-1 confidence scores:
- Observations: Source confidence
- Signals: Detection confidence
- Patterns: Pattern strength
- Hypotheses: Evidence confidence
- Insights: Validation confidence
- Recommendations: Feasibility confidence

### Full Evidence Tracing

Each learning component traces back to source:
```
Recommendation → Insight → Hypothesis → Patterns → Observations
```

Users can drill down to understand why each recommendation was made.

---

## Safety & Guarantees

1. **Determinism**: Same execution data produces same insights
2. **No Embedded Logic**: All logic parameterizable
3. **Traceability**: Full evidence chain for all outputs
4. **Confidence Tracking**: Uncertainty explicitly modeled
5. **Extensibility**: New domains and signals supported
6. **Reusability**: Insights work across enterprises
7. **Privacy**: Learning derived from aggregate patterns, not individuals

---

## Testing

Complete test coverage: **30+ tests, 100% passing**

Test Categories:
- Contract validation (8 tests)
- Status lifecycle (3 tests)
- Serialization (3 tests)
- Learning Engine (10 tests)
- Full pipeline (3 tests)
- Domain support (3 tests)
- Comparison analysis (4 tests)
- Validation (4 tests)

Run tests:
```bash
node tools/genesis/genesis.mjs test
```

---

## Next Steps: Phase 20

**Enterprise Optimization Engine v1**
- Uses Learning Engine insights
- Recommends performance optimizations
- Models optimization impact
- Tracks optimization effectiveness

---

## References

- [0001-genesis-architecture.md](0001-genesis-architecture.md) - Overall architecture
- [0022-knowledge-graph-compiler.md](0022-knowledge-graph-compiler.md) - Knowledge Graph (Phase 18)
- [0021-business-compiler.md](0021-business-compiler.md) - Business Compiler (Phase 17)
- [0018-planning-engine.md](0018-planning-engine.md) - Planning Engine
- [0020-ai-orchestrator-kernel.md](0020-ai-orchestrator-kernel.md) - AI Orchestrator
