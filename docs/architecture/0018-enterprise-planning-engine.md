# ADR-0018: Genesis Enterprise Planning Engine v1

**Status:** Implemented  
**Date:** 2026-07-08  
**Version:** 1.0

## Overview

The Genesis Enterprise Planning Engine v1 is a metadata-driven planning system that generates actionable enterprise plans directly from runtime state and system metadata. Unlike traditional planning systems that rely on hardcoded business rules or AI-generated recommendations, this engine operates purely on structural analysis of the enterprise digital twin.

### Core Purpose

Generate comprehensive, actionable enterprise plans for 8 planning domains without relying on hardcoded business logic.

**Supported Planning Domains:**
- Operations: Process optimization and operational efficiency
- Manufacturing: Production planning and resource allocation
- Inventory: Stock management and replenishment strategies
- Purchasing: Procurement and vendor optimization
- Projects: Delivery timelines and resource planning
- Staffing: Team composition and capacity planning
- Maintenance: Equipment lifecycle and preventive care
- Sales: Revenue optimization and market positioning

## Architecture

### Component Structure

```
Planning Engine Architecture
┌─────────────────────────────────────────┐
│         Enterprise Planning             │
├─────────────────────────────────────────┤
│  Input: Runtime State + Metadata        │
│  ├─ Digital Twin                        │
│  ├─ Module Definitions                  │
│  ├─ Workflows & Automations            │
│  ├─ Events & Permissions               │
│  └─ Schedules & Configurations         │
├─────────────────────────────────────────┤
│  Metadata-Driven Analysis               │
│  ├─ Runtime State Analyzer             │
│  ├─ Module Detector                    │
│  ├─ Workflow Inspector                 │
│  ├─ Efficiency Calculator              │
│  └─ Dependency Graph Builder           │
├─────────────────────────────────────────┤
│  Plan Generation (10-Stage Pipeline)    │
│  1. Initialize Blueprint                │
│  2. Load Context                        │
│  3. Analyze Runtime                     │
│  4. Generate Actions                    │
│  5. Calculate Dependencies              │
│  6. Estimate Confidence                │
│  7. Generate Recommendations           │
│  8. Generate Alternatives              │
│  9. Finalize Result                    │
│  10. Persist Artifacts                 │
├─────────────────────────────────────────┤
│  Output: Actionable Enterprise Plan     │
│  ├─ Prioritized Actions                │
│  ├─ Dependencies & Sequencing          │
│  ├─ Confidence Scores                  │
│  ├─ Alternative Approaches             │
│  └─ Impact Estimates                   │
└─────────────────────────────────────────┘
```

### Key Contracts

#### PlanningGoal
Represents strategic or operational goals that drive planning decisions.
- **Properties:** name, domain, targetMetric, currentValue, targetValue, timeframe, priority
- **Methods:** validate(), markActive(), getSummary(), toJSON()

#### PlanningConstraint
Represents constraints that limit the scope of possible actions.
- **Properties:** name, type (budget/time/resource/regulatory/technical/capacity), value, unit, scope, severity
- **Methods:** validate(), markActive(), markViolated(), getSummary(), toJSON()

#### PlanningAction
Represents a recommended or planned action to achieve goals.
- **Properties:** name, domain, type (optimize/create/modify/retire/automate/scale/migrate), priority
- **Properties:** estimatedEffort, estimatedImpact, confidence, dependencies, assumptions, risks
- **Methods:** validate(), markScheduled(), getSummary(), toJSON()

#### PlanningRecommendation
Represents higher-level guidance based on action analysis.
- **Properties:** name, category (process/technology/organizational/financial/strategic)
- **Properties:** expectedBenefit, implementationCost, timeToValue, confidence, actions
- **Methods:** validate(), markApproved(), getSummary(), toJSON()

#### PlanningContext
Contains execution context for planning (tenant, domain, scope).
- **Properties:** tenantId, organizationId, planningDomain, planningLevel, executionMode
- **Properties:** constraints[], goals[], planningHorizon
- **Methods:** validate(), markActive(), markCompleted()

#### PlanningResult
Contains generated actions, recommendations, and metrics.
- **Properties:** actions[], recommendations[], alternativePlans[], metrics{}
- **Methods:** recordAction(), recordRecommendation(), recordAlternativePlan(), finalize()

#### EnterprisePlan
Main planning contract representing a complete enterprise plan.
- **Properties:** name, domain, goals[], constraints[], context, result
- **Properties:** metadata (createdBy, approvedBy, versions), status (draft/validated/approved/executing/completed)
- **Methods:** validate(), markValidated(), markApproved(), markExecuting(), markCompleted()

### 10-Stage Execution Pipeline

#### Stage 1: Initialize Blueprint
- Create EnterprisePlan with domain and metadata
- Create PlanningResult container
- Mark plan as validated

#### Stage 2: Load Planning Context
- Create PlanningContext with tenant and domain information
- Attach goals and constraints
- Set planning horizon and execution mode
- Mark context as active

#### Stage 3: Analyze Runtime State
- Load module definitions from Digital Twin
- Extract workflow information and efficiency metrics
- Analyze automation execution patterns
- Map events and permissions
- Load schedule information
- Calculate derived metrics (module count, workflow count, etc.)

#### Stage 4: Generate Domain Actions
- Execute domain-specific action generators
- Each domain analyzes its runtime state
- Generate actionable initiatives based on structure
- Calculate estimated effort, impact, and rationale
- Record all actions in result

#### Stage 5: Calculate Dependencies
- Analyze relationships between actions
- Build dependency graph
- Identify prerequisites and sequencing
- Link related actions

#### Stage 6: Estimate Confidence
- Calculate confidence based on multiple factors
  - Effort estimates (lower effort = higher confidence)
  - Impact magnitude (moderate = higher confidence)
  - Priority level (high priority = higher confidence)
  - Historical success rates
- Normalize to 50-100 range
- Update metrics

#### Stage 7: Generate Recommendations
- Group actions by category
- Create strategic recommendations
- Calculate aggregate metrics
- Link recommendations to actions
- Include cost/benefit analysis

#### Stage 8: Generate Alternative Plans
1. **Conservative Approach:** Low-risk, phased implementation
   - Focus on high-confidence actions (>80%)
   - Longer timeline (6-9 months)
   - Lower cost and risk
   
2. **Aggressive Approach:** Parallel implementation
   - Execute all initiatives simultaneously
   - Shorter timeline (3-4 months)
   - Higher cost and risk

#### Stage 9: Finalize Result
- Calculate average confidence across all items
- Validate all metrics
- Mark result as approved
- Attach to plan

#### Stage 10: Persist Artifacts
Write 5 JSON files for audit trail:
1. **plan-blueprint.json** - Plan configuration and metadata
2. **planning-context.json** - Context and constraints
3. **planning-result.json** - Generated actions and recommendations
4. **runtime-analysis.json** - Runtime metrics snapshot
5. **plan-full.json** - Complete plan with all data

## Metadata-Driven Planning

### No Hardcoded Business Logic

The engine generates plans entirely from structural analysis:

```javascript
// NOT: if (module === "inventory" && efficiency < 70) { ... }
// INSTEAD:
const lowEfficiencyWorkflows = runtimeState.workflows
  .filter(w => w.module === domain && w.efficiency < 70)
  .map(w => createOptimizeAction(w));
```

### Domain-Specific Analysis

Each domain implements analysis functions:

**Operations Domain:**
- Detects low-efficiency workflows
- Identifies approval bottlenecks
- Recommends automation opportunities
- Suggests monitoring enhancements

**Inventory Domain:**
- Analyzes reorder point efficiency
- Identifies low-stock alert opportunities
- Recommends ABC inventory analysis
- Suggests demand-based optimization

**Manufacturing Domain:**
- Detects maintenance intervals
- Recommends predictive maintenance
- Identifies capacity constraints
- Suggests scheduling optimizations

### Confidence Calculation

Confidence is calculated from multiple factors:
```
Base: 75%
+ Action Effort Adjustment: ±10% (high effort = lower)
+ Impact Adjustment: ±5% (moderate impact = higher)
+ Priority Adjustment: ±3% (high priority = higher)
= Final Confidence (50-100%)
```

## Planning Consumption

### Input Sources

1. **Enterprise Digital Twin**
   - Module structure and definitions
   - Entity definitions
   - Relationship mappings

2. **Runtime State**
   - Workflow efficiency metrics
   - Automation execution counts
   - Event frequencies
   - Permission mappings

3. **Metadata**
   - Domain information
   - Capability definitions
   - Schedule templates
   - Constraint definitions

4. **Optional User Input**
   - Planning goals
   - Constraints
   - Priorities

## Planning Output

### Actions
Concrete steps with:
- Estimated effort (hours)
- Estimated impact (0-100)
- Confidence (50-100%)
- Priority (low/medium/high/critical)
- Dependencies
- Assumptions and risks

### Recommendations
Strategic guidance with:
- Category (process/technology/organizational/financial/strategic)
- Expected benefits
- Implementation cost
- Time to value
- Related actions
- Alternative approaches

### Metrics
Comprehensive planning metrics:
- `totalActionsGenerated` - Number of actionable initiatives
- `highPriorityActions` - Count of critical/high priority items
- `totalRecommendations` - Strategic recommendations count
- `implementationTimeframe` - Estimated timeline (days)
- `estimatedTotalEffort` - Cumulative effort (hours)
- `estimatedTotalImpact` - Aggregate impact (0-100)
- `averageConfidence` - Mean confidence across items (0-100%)
- `affectedModules` - Modules affected by plan
- `affectedObjects` - Entities affected by plan
- `constraintsConsidered` - Number of constraints analyzed
- `goalsAddressed` - Number of goals targeted

### Alternative Plans
Multiple implementation strategies:
1. **Conservative:** Phased approach (low risk, longer timeline)
2. **Aggressive:** Parallel execution (high risk, shorter timeline)

## CLI Integration

### Command: plan enterprise

```bash
# Generate enterprise-wide plan
node tools/genesis/genesis.mjs plan enterprise

# For specific domain
node tools/genesis/genesis.mjs plan operations --tenant=corp-001
node tools/genesis/genesis.mjs plan inventory --dry-run

# Other domains
plan manufacturing, plan purchasing, plan projects
plan staffing, plan maintenance, plan sales

# Display results
node tools/genesis/genesis.mjs plan results --verbose
```

### Options
- `--tenant <id>` - Specify tenant (default: 'default')
- `--domain <domain>` - Specify planning domain
- `--dry-run` - Execute in analysis mode (no changes)
- `--verbose, -v` - Show detailed output
- `--help, -h` - Show help

## API Usage

```javascript
import { PlanningEngine } from './tools/genesis/compiler/PlanningEngine.mjs';

const engine = new PlanningEngine();

const result = await engine.executePlanning({
  name: 'Q3 Operations Plan',
  domain: 'operations',
  context: {
    tenantId: 'corp-001',
    planningHorizon: 90,
    goals: [...],      // Optional PlanningGoal[]
    constraints: [...]  // Optional PlanningConstraint[]
  }
});

// Access generated plan
const plan = engine.plan;          // EnterprisePlan
const result = engine.result;      // PlanningResult
const actions = result.actions;    // PlanningAction[]
const recommendations = result.recommendations;  // PlanningRecommendation[]
```

## Testing

### Test Coverage
- 40+ comprehensive unit tests
- Contract initialization and validation
- Status transitions
- Pipeline execution
- Multi-domain support
- End-to-end planning scenarios

### Test Categories
1. **Contract Tests** (24 tests)
   - Goal, Constraint, Action, Recommendation, Context, Result, Plan

2. **Engine Tests** (8 tests)
   - Initialization, execution, action/recommendation generation
   - Confidence calculation, dependencies, multi-domain

3. **Integration Tests** (8 tests)
   - End-to-end scenarios
   - Multiple domains
   - Metrics validation
   - Artifact persistence

## Safety Guarantees

### Read-Only Operation
- Planning reads production state only
- No modifications to runtime systems
- No changes to Digital Twin
- Completely isolated planning context

### Deterministic Results
- Same runtime state + goals = same plan
- Repeatable execution
- No random side effects
- Complete audit trail

### Data Isolation
- Plans for each tenant are isolated
- No cross-tenant data leakage
- Per-tenant artifact storage
- Tenant-scoped context

## Integration Points

### Depends On
- **Digital Twin** (Phase 12) - Reads module and entity definitions
- **Identity & Tenant Platform** (Phase 11) - Tenant scoping
- **Runtime State** (Phases 1-10) - Workflow and automation metrics

### Provides To
- **CLI Framework** - plan command
- **Artifact Storage** - Persisted plan files
- **Future Simulation Engine** - Plans can inform simulations

## Performance Characteristics

### Complexity Analysis
- Time: O(n) where n = total runtime items (workflows, automations, events)
- Space: O(n) for cloned context and generated artifacts
- Typical execution: < 2 seconds for enterprise-wide plans

### Scaling
- Supports thousands of modules
- Handles hundreds of workflows per domain
- Processes thousands of events
- Generates personalized plans for each tenant

## Future Enhancements

1. **Machine Learning Integration**
   - Learn from plan effectiveness
   - Improve confidence calculations
   - Predict success rates

2. **Advanced Prioritization**
   - Resource constraint optimization
   - Dependency resolution
   - Schedule-aware sequencing

3. **Plan Execution Tracking**
   - Monitor action completion
   - Track metric changes
   - Measure plan impact

4. **Collaborative Planning**
   - Multi-user plan modification
   - Version management
   - Approval workflows

5. **Predictive Planning**
   - Forecast future needs
   - Scenario-based planning
   - Impact prediction

## References

- Phase 11: Identity & Tenant Platform
- Phase 12: Enterprise Digital Twin
- Phase 13: Enterprise Simulation Engine
- ADR-0004: Domain Model
- ADR-0012: Enterprise Digital Twin

## Appendix: Example Plan Output

```json
{
  "plan": {
    "id": "plan-a1b2c3d4",
    "name": "Operations Enterprise Plan",
    "domain": "operations",
    "status": "approved",
    "result": {
      "totalActionsGenerated": 3,
      "highPriorityActions": 1,
      "totalRecommendations": 2,
      "averageConfidence": 85,
      "estimatedTotalImpact": 52,
      "actions": [
        {
          "name": "Optimize Approval Workflow",
          "type": "optimize",
          "priority": "high",
          "estimatedEffort": 16,
          "estimatedImpact": 25,
          "confidence": 85,
          "rationale": "Current workflow has 65% efficiency; removing steps improves by 25%"
        }
      ],
      "recommendations": [
        {
          "name": "Process Optimization Initiative",
          "category": "process",
          "confidence": 83,
          "expectedBenefit": "60% estimated total impact"
        }
      ],
      "alternativePlans": [
        {
          "name": "Conservative Implementation",
          "riskLevel": "Low",
          "estimatedDuration": "6-9 months"
        }
      ]
    }
  }
}
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-07-08  
**Author:** Genesis Architecture Team  
**Status:** Final
