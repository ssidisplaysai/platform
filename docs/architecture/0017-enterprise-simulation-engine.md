# ADR-0017: Enterprise Simulation Engine Architecture

**Status:** Implemented
**Date:** 2024
**Scope:** Phase 13 - Enterprise Simulation Engine v1

## Overview

The Enterprise Simulation Engine is a metadata-driven simulation platform that operates exclusively on cloned copies of the Enterprise Digital Twin. It executes hypothetical scenarios and impact analyses without ever modifying production runtime state, providing organizations with safe, repeatable, and deterministic simulation capabilities.

### Purpose

- **Safe Simulation:** Never modifies production runtime or twin state
- **Impact Analysis:** Model cascading effects of hypothetical changes
- **What-If Scenarios:** Test business decisions before implementation
- **Risk Assessment:** Identify potential issues before deployment
- **Deterministic Results:** Repeatable simulations with same inputs
- **Decision Support:** Generate comprehensive reports for stakeholders

## Core Architecture

### Simulation Model

```
┌─────────────────────────────────────────────┐
│  Enterprise Simulation                      │
│  ├─ Blueprint: SimulationBlueprint          │
│  ├─ Scenario: SimulationScenario            │
│  ├─ Context: SimulationContext              │
│  ├─ Execution: SimulationExecution          │
│  ├─ Result: SimulationResult                │
│  ├─ Report: SimulationReport                │
│  └─ Cloned Twin: Isolated copy              │
└─────────────────────────────────────────────┘
```

### Execution Guarantee: Production Isolation

The engine maintains complete isolation from production:

1. **No Direct Access:** Simulation engine never accesses production twin
2. **Clone-First:** Every simulation starts by cloning the twin
3. **Metadata-Only:** All changes are simulated at metadata level
4. **No Persistence:** Cloned state is never written back to production
5. **Independent Analysis:** Each simulation is completely independent

```
Production Twin (READ ONLY)
        ↓ [Clone - Deep Copy]
┌─────────────────────┐
│ Cloned Twin State   │
│ (Isolated)          │
└─────────────────────┘
        ↓
   [Simulate Changes]
        ↓
   [Analyze Impacts]
        ↓
   [Generate Report]
        ↓
Production Twin (UNCHANGED) ✓
```

### Component Architecture

#### 1. SimulationScenario
Describes the hypothetical scenario to simulate

**Properties:**
- `id`: Unique scenario identifier
- `name`: Human-readable scenario name
- `description`: Detailed description
- `type`: Simulation type (hypothetical, what-if, stress-test, impact-analysis)
- `changes`: Array of hypothetical changes to apply
- `assumptions`: Key-value assumptions for the scenario
- `constraints`: Business rules/constraints
- `scope`: all, module, application, or organization
- `scopeId`: Target entity ID if scoped

**Change Types:**
- `lifecycle` - Object lifecycle state changes (activate, suspend, retire)
- `workflow` - Workflow modifications (add step, remove step, reorder)
- `inventory` - Inventory/asset changes (add, remove, adjust quantities)
- `staffing` - Personnel changes (add, remove, change roles)
- `schedule` - Schedule modifications (timing, frequency)
- `financial` - Financial assumptions (rates, costs, budgets)
- `configuration` - Configuration changes (settings, parameters)

#### 2. SimulationContext
Execution context for a simulation

**Properties:**
- `tenantId`: Target tenant
- `organizationId`: Target organization
- `clonedTwinId`: ID of this simulation's cloned twin
- `executionMode`: dry-run or full-simulation
- `simulationLevel`: basic, detailed, or comprehensive
- `includeMetrics`: Whether to track metrics
- `trackImpact`: Whether to track cascading impacts
- `status`: initialized, executing, completed, failed

#### 3. SimulationExecution
Records the execution of a simulation

**Properties:**
- `simulationId`: Parent simulation ID
- `contextId`: Execution context ID
- `startTime`: When execution started
- `endTime`: When execution completed
- `status`: running, completed, failed
- `stepsExecuted`: Number of steps completed
- `stepsTotal`: Total steps to execute
- `progress`: Percentage completion (0-100)
- `executionLog`: Timestamped log of all steps
- `errors`: Any errors encountered

#### 4. SimulationImpact
Records the impact of a simulated change

**Properties:**
- `changeId`: Which change caused this impact
- `targetNodeId`: Primary affected node
- `targetNodeType`: Node type (object, workflow, etc.)
- `impactType`: direct, cascading, or dependent
- `severity`: low, medium, high, or critical
- `affectedNodes`: List of all impacted nodes
- `affectedCount`: Total count of affected nodes
- `riskLevel`: low, medium, high, or critical
- `recommendations`: Recommendations for mitigation

**Impact Types:**
- `direct` - Immediate change to target node
- `cascading` - Change propagates to dependent nodes
- `dependent` - Nodes that depend on changed node

**Risk Calculation:**
```
Factors:
  - Number of affected nodes (weight: 0.6)
  - Severity of each impact (weight: 0.4)

Risk Level:
  critical - > 50 nodes OR avg severity >= 3
  high     - > 20 nodes OR avg severity >= 2.5
  medium   - > 5 nodes OR avg severity >= 1.5
  low      - Otherwise
```

#### 5. SimulationResult
Complete result of a simulation

**Properties:**
- `id`: Unique result identifier
- `simulationId`: Parent simulation
- `executionId`: Parent execution
- `scenarioId`: Parent scenario
- `success`: Whether all changes succeeded
- `status`: pending, success, partial, or failed
- `executedChanges`: Array of changes executed
- `impacts`: Array of identified impacts
- `metrics`: Statistics about the simulation
- `errors`: Any errors encountered

**Metrics:**
```javascript
{
  totalChanges: 10,
  successfulChanges: 10,
  failedChanges: 0,
  affectedObjects: 5,
  affectedWorkflows: 3,
  affectedAutomations: 2,
  totalImpactedNodes: 12
}
```

#### 6. SimulationReport
Comprehensive report for stakeholders

**Properties:**
- `id`: Unique report identifier
- `simulationId`: Parent simulation
- `scenarioName`: Name of scenario
- `impacts`: All identified impacts
- `riskAnalysis`: Overall risk assessment
- `affectedEntities`: Categorized affected entities
- `recommendations`: Actionable recommendations
- `executionDetails`: Simulation execution details
- `status`: draft, completed, approved, rejected

**Risk Analysis:**
```javascript
{
  overallRisk: "high",        // low, medium, high, critical
  criticalRisks: 0,
  highRisks: 3,
  mediumRisks: 5,
  lowRisks: 8,
  totalRisks: 16
}
```

#### 7. SimulationBlueprint
Main blueprint for simulation configuration

**Properties:**
- `id`: Simulation ID
- `blueprintId`: Blueprint ID
- `tenantId`: Target tenant
- `organizationId`: Target organization
- `scenario`: SimulationScenario instance
- `context`: SimulationContext instance
- `execution`: SimulationExecution instance
- `result`: SimulationResult instance
- `report`: SimulationReport instance
- `clonedTwin`: Cloned twin state
- `status`: draft, validated, deployed, executing, completed

## Simulation Engine Pipeline

### 10-Stage Execution

#### Stage 1: Initialize Blueprint
Creates SimulationBlueprint and prepares infrastructure

#### Stage 2: Create Scenario
Creates SimulationScenario with hypothetical changes

#### Stage 3: Validate Scenario
Validates scenario structure and changes

#### Stage 4: Clone Digital Twin
Creates deep copy of production twin
**Critical:** No production state is modified

#### Stage 5: Apply Changes
Applies hypothetical changes to cloned state
- Simulates lifecycle changes
- Simulates workflow modifications
- Simulates configuration changes
- Never touches production

#### Stage 6: Analyze Impacts
Analyzes direct impacts of each change
- Examines relationships in cloned twin
- Identifies affected nodes
- Records impact type and severity

#### Stage 7: Calculate Cascading Effects
Models propagation of impacts
- Direct impacts identified
- Cascading impacts calculated
- Dependent impacts determined

#### Stage 8: Generate Execution Result
Creates SimulationResult with metrics

#### Stage 9: Generate Report
Creates comprehensive SimulationReport
- Summarizes all impacts
- Analyzes risks
- Provides recommendations

#### Stage 10: Persist Artifacts
Writes simulation outputs to disk
- simulation-blueprint.json
- simulation-execution.json
- simulation-result.json
- simulation-report.json
- simulation-full.json

## Supported Simulation Types

### 1. Hypothetical Scenarios
Free-form what-if scenarios with custom changes
```bash
node tools/genesis/genesis.mjs simulate scenario \
  --scenario="Q4 Staffing" \
  --type=what-if
```

### 2. Lifecycle Impact Analysis
Simulate object lifecycle state changes
```bash
node tools/genesis/genesis.mjs simulate lifecycle \
  --target=obj-1 \
  --action=suspend
```

### 3. Workflow Modifications
Simulate changes to workflows
```bash
node tools/genesis/genesis.mjs simulate workflow \
  --module=mod-1 \
  --changes=add-step,reorder
```

### 4. Inventory Changes
Simulate inventory adjustments and impacts
```bash
node tools/genesis/genesis.mjs simulate inventory \
  --tenant=acme-corp
```

### 5. Staffing Changes
Simulate team composition changes
```bash
node tools/genesis/genesis.mjs simulate staffing \
  --tenant=acme-corp
```

### 6. Impact Analysis
Analyze cascading impacts of changes
```bash
node tools/genesis/genesis.mjs simulate impact \
  --object=obj-1
```

### 7. Stress Testing
Test system resilience under stress
```bash
node tools/genesis/genesis.mjs simulate stress-test \
  --tenant=acme-corp
```

## Production Safety Guarantees

### 1. Zero Production Access
- Simulation engine never reads from production state
- All operations use cloned twin exclusively
- Production twin is read-only for simulations

### 2. No State Mutation
- Cloned state cannot affect production
- Changes are simulated at metadata level
- No entity creation, deletion, or modification

### 3. Repeatable Execution
- Same inputs produce same outputs
- Deterministic results by design
- Previous simulations can be replayed

### 4. Complete Isolation
- Each simulation is independent
- No cross-simulation interference
- Errors in one simulation don't affect others

### 5. Audit Trail
- Complete execution log
- All changes recorded
- All impacts documented

## Data Flow

```
User Request
    ↓
┌─────────────────────────────────────┐
│ Stage 1-3: Setup & Validation       │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Stage 4: Clone Production Twin      │
│ (Deep copy of read-only state)      │
└────────────┬────────────────────────┘
             ↓
         Cloned State
         (Isolated)
             ↓
┌─────────────────────────────────────┐
│ Stage 5-7: Simulate & Analyze       │
│ (All changes in cloned state)       │
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│ Stage 8-10: Result & Report         │
└────────────┬────────────────────────┘
             ↓
         Output Artifacts
         (4+ JSON files)
             ↓
Production Twin (UNCHANGED) ✓
```

## CLI Commands

### Run Scenario Simulation
```bash
node tools/genesis/genesis.mjs simulate scenario \
  --scenario="Test Scenario" \
  --type=what-if \
  --dry-run
```

### Run Lifecycle Simulation
```bash
node tools/genesis/genesis.mjs simulate lifecycle \
  --target=obj-1 \
  --action=suspend
```

### Run Workflow Simulation
```bash
node tools/genesis/genesis.mjs simulate workflow \
  --module=mod-1 \
  --changes=add-step
```

### Run Impact Analysis
```bash
node tools/genesis/genesis.mjs simulate impact \
  --object=obj-1
```

### Run Stress Test
```bash
node tools/genesis/genesis.mjs simulate stress-test
```

### View Results
```bash
node tools/genesis/genesis.mjs simulate results
```

## API Usage

### Execute Simulation Programmatically

```javascript
import { SimulationEngine } from "./compiler/SimulationEngine.mjs";

const engine = new SimulationEngine("my-tenant");

const scenario = {
  name: "Q4 Changes",
  type: "what-if",
  changes: [
    {
      type: "staffing",
      targetId: "team-1",
      nodeType: "team",
      properties: { memberCount: 10 }
    }
  ]
};

const success = await engine.executeSimulation(scenario);

if (success) {
  const results = engine.getResults();
  console.log(`Risk Level: ${results.riskLevel}`);
  console.log(`Affected Nodes: ${results.affectedNodes}`);
}
```

### Access Simulation Results

```javascript
const blueprint = engine.blueprint;
const report = blueprint.report;

console.log(`Scenario: ${report.scenarioName}`);
console.log(`Overall Risk: ${report.riskAnalysis.overallRisk}`);
console.log(`Affected Objects: ${report.affectedEntities.objects.length}`);
console.log(`Recommendations: ${report.recommendations}`);
```

## Artifact Schema

### simulation-report.json
```json
{
  "id": "report-xxx",
  "simulationId": "sim-xxx",
  "scenarioName": "Test Scenario",
  "status": "completed",
  "riskAnalysis": {
    "overallRisk": "high",
    "criticalRisks": 0,
    "highRisks": 2,
    "mediumRisks": 5,
    "lowRisks": 10,
    "totalRisks": 17
  },
  "affectedEntityCount": {
    "objects": 3,
    "workflows": 2,
    "automations": 1,
    "dependencies": 5
  },
  "recommendations": [
    "High risk - recommend stakeholder review"
  ],
  "totalImpacts": 5,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### simulation-result.json
```json
{
  "id": "result-xxx",
  "simulationId": "sim-xxx",
  "status": "success",
  "success": true,
  "executedChanges": 5,
  "impacts": 8,
  "metrics": {
    "totalChanges": 5,
    "successfulChanges": 5,
    "failedChanges": 0,
    "affectedObjects": 3,
    "affectedWorkflows": 2,
    "affectedAutomations": 1,
    "totalImpactedNodes": 8
  },
  "errors": [],
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Testing

30 comprehensive tests covering:

- **Scenarios:** Creation, validation, status transitions
- **Context:** Initialization, validation, execution management
- **Execution:** Step tracking, error recording, completion
- **Impact:** Creation, analysis, risk calculation, recommendations
- **Results:** Recording changes, tracking metrics, finalization
- **Reports:** Entity tracking, recommendations, risk analysis
- **Blueprint:** Creation, validation, status transitions
- **Engine:** Initialization, isolation verification, deterministic results
- **Safety:** Production isolation guarantee, no state mutation
- **Analysis:** Impact analysis, cascading effect calculation

All tests verify:
- ✅ Metadata-driven operation
- ✅ Production isolation
- ✅ Deterministic results
- ✅ No state mutation
- ✅ Complete audit trail

## Integration Points

### With Digital Twin
- Reads production twin (read-only)
- Clones for simulation
- Never modifies production

### With Identity System
- Respects tenant isolation
- Uses tenant context
- Maintains organization boundaries

### With Application Architecture
- Discovers modules and objects
- Models workflows and automations
- Analyzes configurations

## Future Enhancements

### Phase 14
- Advanced impact prediction
- Machine learning for risk assessment
- Parallel simulation execution
- Performance optimizations

### Later Phases
- Simulation scheduling and batching
- Comparative scenario analysis
- Recommendation engine
- What-if chaining
- Continuous monitoring integration

## Related Documents

- [0016-enterprise-digital-twin.md](./0016-enterprise-digital-twin.md) - Digital Twin system
- [0015-identity-and-tenant-architecture.md](./0015-identity-and-tenant-architecture.md) - Tenant system
- [0008-ai-runtime.md](./0008-ai-runtime.md) - Runtime architecture
