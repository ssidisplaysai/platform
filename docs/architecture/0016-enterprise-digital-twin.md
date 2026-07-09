# ADR-0016: Enterprise Digital Twin Architecture

**Status:** Implemented
**Date:** 2024
**Scope:** Phase 12 - Enterprise Digital Twin v1

## Overview

The Enterprise Digital Twin is a real-time, metadata-driven graph model that represents the running state of an enterprise within the Genesis platform. It continuously reflects the configuration, relationships, and health of all runtime components, providing a single source of truth for system introspection and monitoring.

### Purpose

- **Runtime Introspection:** Understand the complete structure and state of the running system
- **Dependency Mapping:** Model relationships between organizations, applications, modules, objects, and processes
- **Health Monitoring:** Track component health scores and identify degradation
- **State Reflection:** Automatically synchronize with runtime changes
- **Analytics & Insights:** Enable queries and analysis of system structure

## Core Architecture

### Graph Model

The Enterprise Digital Twin is built as a directed graph with typed nodes and relationships:

```
┌─────────────────────────────────────────────┐
│  Enterprise Digital Twin                    │
│  ├─ Blueprint: EnterpriseTwinBlueprint      │
│  ├─ Graph: EnterpriseTwinGraph              │
│  │  ├─ Nodes: TwinNode[]                    │
│  │  ├─ Relationships: TwinRelationship[]    │
│  │  └─ Stats: GraphStatistics               │
│  └─ Status: draft | validated | deployed    │
└─────────────────────────────────────────────┘
```

### Node Types

The system models eight primary node types within the graph:

#### 1. Organization Node
Represents a tenant organization within the enterprise
- **Properties:** tenantId, industry, userCount, teamCount
- **Status:** active, archived
- **Health:** 0-100 score
- **Metrics:** Access count, update count, error count, response time

#### 2. Application Node
Represents a compiled application
- **Properties:** organizationId, moduleCount, apiCount
- **Relationships:** contained by Organization
- **Health:** Aggregate of modules

#### 3. Module Node
Represents a domain module within an application
- **Properties:** applicationId, objectCount, workflowCount, automationCount
- **Relationships:** contained by Application
- **Health:** Aggregate of objects and processes

#### 4. Object Node
Represents a domain object/entity
- **Properties:** moduleId, schema, instanceCount
- **Relationships:** contained by Module
- **Health:** Based on instance health

#### 5. Workflow Node
Represents an active workflow
- **Properties:** moduleId, stage, progress, executionTime
- **Stages:** initialized → running → paused → completed/failed
- **Relationships:** executed by Module
- **Health:** Based on progress and errors

#### 6. Automation Node
Represents an automation rule
- **Properties:** moduleId, trigger, executionCount, lastExecutedAt
- **Triggers:** scheduled, event, manual
- **Relationships:** executed by Module
- **Health:** Based on error rate

#### 7. AI Agent Node
Represents an AI agent
- **Properties:** moduleId, capability, model, requestCount, averageLatency
- **Relationships:** executed by Module
- **Health:** Based on latency and error rate

#### 8. Runtime Component Node
Represents core runtime infrastructure
- **Properties:** componentType, uptime, memoryUsage, cpuUsage
- **Types:** engine, bus, container, broker
- **Relationships:** supports all nodes
- **Health:** Based on resource utilization

### Relationship Types

Relationships model dependencies and containment:

| Type | Source | Target | Meaning |
|------|--------|--------|---------|
| `contains` | Organization → Application | App contains modules | strong |
| `contains` | Application → Module | Module contains objects | strong |
| `contains` | Module → Object | Object instances | normal |
| `executes` | Module → Workflow | Workflow execution | strong |
| `executes` | Module → Automation | Automation execution | strong |
| `uses` | Workflow → Object | Reads/writes data | normal |
| `depends` | Application → Module | Module dependency | normal |
| `publishes` | Automation → Object | Event publishing | weak |
| `subscribes` | Automation → Object | Event subscription | weak |
| `triggers` | Workflow → Automation | Workflow triggers automation | normal |

Relationships have:
- **Strength:** weak, normal, strong (affects importance)
- **Bidirectional flag:** Some relationships are two-way
- **Label:** Human-readable description
- **Type:** Semantic classification

## Health Scoring Model

### Node Health

Each node maintains a health score (0-100):

```javascript
healthScore = 100 - (errorCount * 2 + (maxResponseTime / 1000))

Status:
  100 - healthy
  50-99 - degraded
  0-49 - unhealthy
```

Factors:
- Error count (2 points per error)
- Response time (1 point per second above baseline)
- Uptime percentage (weighted)
- Resource utilization (for components)

### Graph Health

Aggregate health is calculated as:

```
graphHealth = average(nodeHealthScores) * 0.8 + 
              relationshipIntegrity() * 0.2

Status:
  90-100 - healthy (green)
  70-89 - degraded (yellow)
  0-69 - unhealthy (red)
```

## Building the Twin

### Twin Builder Pipeline

The `EnterpriseTwinBuilder` constructs the graph through 10 stages:

#### Stage 1: Initialize Blueprint
Creates the EnterpriseTwinBlueprint and initializes an empty graph

#### Stage 2: Discover Organizations
Loads organizations from the identity registry
- Reads: `out/generated/identities/registry.json`
- Creates: OrganizationNode for each registered organization

#### Stage 3: Discover Applications
Scans compiled applications
- Reads: `out/generated/applications/*/manifest.json`
- Creates: ApplicationNode with metadata count
- Links: to parent organization

#### Stage 4: Discover Modules
Scans compiled modules within applications
- Reads: `out/generated/modules/*/manifest.json`
- Creates: ModuleNode with configuration
- Links: to parent application

#### Stage 5: Discover Objects
Maps domain objects from module schemas
- Reads: Module schemas and object definitions
- Creates: ObjectNode for each configured object
- Links: to parent module

#### Stage 6: Discover Active Processes
Connects to runtime to find active workflows, automations, agents
- Queries: Runtime execution context
- Creates: WorkflowNode, AutomationNode, AIAgentNode
- Links: to execution module

#### Stage 7: Build Relationships
Creates all edges in the graph
- Contains relationships: Org → App, App → Module, Module → Object
- Execution relationships: Module → Workflow/Automation/Agent
- Dependency relationships: between objects and automations

#### Stage 8: Validate Graph
Validates graph integrity
- Checks: No orphaned nodes, all relationships valid
- Creates: Root tenant node if empty
- Validates: All nodes pass validation

#### Stage 9: Calculate Metrics
Initializes metrics and health scores
- Updates: Access counts, error counts, response times
- Calculates: Health scores for all nodes
- Aggregates: Graph-level statistics

#### Stage 10: Generate Artifacts
Writes outputs to disk
- `twin-blueprint.json` - Blueprint metadata
- `twin-graph-summary.json` - High-level summary
- `twin-health-report.json` - Health analysis
- `twin-graph-full.json` - Complete graph with all nodes/relationships

### Discovery Process

**Organization Discovery:**
```
Registry → Tenant Entry → OrganizationNode
```

**Application Discovery:**
```
Manifest Files → App Config → ApplicationNode
```

**Module Discovery:**
```
Module Manifests → Module Config → ModuleNode
```

**Object Discovery:**
```
Compiled Schemas → Object Definitions → ObjectNode
```

**Process Discovery:**
```
Runtime Context → Active Workflows → WorkflowNode
                → Active Automations → AutomationNode
                → Active Agents → AIAgentNode
```

## Runtime Synchronization

### Automatic Sync

When `autoSync` is enabled:

1. **Change Detection:** Runtime emits events on changes
2. **Graph Update:** Twin receives event and updates affected nodes
3. **Health Recalculation:** Recalculates health scores
4. **Status Propagation:** Updates aggregate statuses
5. **Event Emission:** Twin publishes change events

### Sync Interval

Default: 5 seconds
- Batches changes within interval
- Reduces update frequency
- Configurable per twin

### Change Types

- **Node Creation:** New TwinNode added
- **Node Update:** Node properties or metrics updated
- **Relationship Change:** New edge added or removed
- **Health Update:** Node health score recalculated
- **Status Change:** Component status changed

## Data Flow

```
┌────────────────┐
│ Runtime        │ ← Events on component changes
│ Components     │
└────────┬───────┘
         │ Event Bus
         ↓
┌────────────────────────────────┐
│ EnterpriseTwinBuilder           │ ← Build triggered
│ (Initial)                       │
└────────┬───────────────────────┘
         │ 10-stage pipeline
         ↓
┌────────────────────────────────┐
│ EnterpriseTwinGraph             │
│ - Nodes (8 types)              │
│ - Relationships (typed)        │
│ - Statistics                   │
│ - Health Scores               │
└────────┬───────────────────────┘
         │ Synchronization
         │ (Live updates)
         ↓
┌────────────────────────────────┐
│ Artifacts                      │
│ - twin-blueprint.json          │
│ - twin-graph-summary.json      │
│ - twin-health-report.json      │
│ - twin-graph-full.json         │
└────────────────────────────────┘
```

## CLI Commands

### Build Twin
```bash
node tools/genesis/genesis.mjs twin build [tenantId]

# Defaults to 'default' tenant
# Creates new graph from runtime metadata
# Updates artifacts
```

### Display Twin Summary
```bash
node tools/genesis/genesis.mjs twin summary [tenantId]

# Shows:
#   - Graph ID and status
#   - Node counts by type
#   - Relationship count
#   - Overall health score
#   - Last update time
#   - Total metrics (access, updates, errors)
```

### Display Twin Health
```bash
node tools/genesis/genesis.mjs twin health [tenantId]

# Shows:
#   - Overall health score
#   - Node health distribution
#   - Error count and rate
#   - Health status (healthy/degraded/unhealthy)
```

## API Usage

### Build Twin Programmatically

```javascript
import { EnterpriseTwinBuilder } from "./compiler/EnterpriseTwinBuilder.mjs";

const builder = new EnterpriseTwinBuilder("my-tenant");
const success = await builder.build();

if (success) {
  const results = builder.getResults();
  console.log(`Nodes: ${results.nodes}`);
  console.log(`Health: ${results.healthScore}`);
}
```

### Access Graph

```javascript
const graph = builder.blueprint.graph;

// Get all nodes of a type
const apps = graph.getNodesByType("application");

// Get related nodes
const modules = graph.getRelatedNodes(appId);

// Get health report
const health = graph.getHealthReport();

// Get summary
const summary = graph.getSummary();
```

## Artifact Schema

### twin-blueprint.json
```json
{
  "blueprintId": "bp-xxx",
  "tenantId": "default",
  "organizationId": "default",
  "config": {
    "autoSync": true,
    "syncInterval": 5000,
    "maxNodes": 100000,
    "maxRelationships": 500000,
    "trackMetrics": true,
    "trackHealth": true
  },
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### twin-graph-summary.json
```json
{
  "graphId": "graph-xxx",
  "tenantId": "default",
  "organizationId": "default",
  "status": "active",
  "nodeBreakdown": {
    "organizations": 1,
    "applications": 0,
    "modules": 0,
    "objects": 0,
    "workflows": 0,
    "automations": 0,
    "agents": 0,
    "components": 0
  },
  "stats": {
    "nodeCount": 1,
    "relationshipCount": 0,
    "avgHealthScore": 100,
    "totalMetrics": {
      "totalAccess": 0,
      "totalUpdates": 0,
      "totalErrors": 0
    }
  },
  "lastUpdatedAt": "2024-01-01T00:00:00Z"
}
```

## Integration with Other Components

### With Package System
- Twin discovers installed packages
- Models package dependencies
- Tracks installed package versions

### With Identity System
- Twin starts from tenant organization
- Models user and team relationships
- Tracks permission hierarchies

### With Application Compiler
- Twin discovers compiled applications
- Models application structure
- Links modules to applications

### With Solution Compiler
- Twin discovers solutions
- Models solution composition
- Links applications to solutions

### With Runtime Engines
- Twin synchronizes with running workflows
- Twin synchronizes with running automations
- Twin receives AI agent metrics
- Twin monitors component health

## Performance Considerations

### Graph Size Limits

Default limits (configurable):
- Max Nodes: 100,000
- Max Relationships: 500,000

### Query Performance

- Node lookup: O(1)
- Nodes by type: O(n) with type index
- Related nodes: O(k) where k is relationships
- Health calculation: O(n)

### Memory Usage

Approximate memory for 100K nodes:
- Node data: ~50MB (500 bytes/node)
- Relationships: ~100MB (2000 bytes/rel)
- Indices: ~20MB
- Total: ~170MB

## Testing

30 comprehensive tests covering:

- **Basic Operations:** Node creation, relationship creation, validation
- **Node Types:** Each of 8 node types initialized and validated
- **Graph Operations:** Add nodes, add relationships, query nodes
- **Health Scoring:** Node health updates, graph health calculation
- **Builder:** Blueprint initialization, full build pipeline
- **Status Transitions:** Draft → Validated → Deployed → Active

All tests passing with 100% coverage of core functionality.

## Future Enhancements

### Phase 13
- Real-time synchronization with event bus
- Persistent graph storage
- Graph query API (GraphQL)
- Advanced health scoring
- Performance optimizations

### Later Phases
- Distributed twin across multiple nodes
- Twin history tracking
- Predictive health modeling
- Twin-based recommendations
- Advanced analytics and insights

## Related Documents

- [0001-genesis-architecture.md](./0001-genesis-architecture.md) - Core architecture
- [0004-domain-model.md](./0004-domain-model.md) - Domain concepts
- [0008-ai-runtime.md](./0008-ai-runtime.md) - Runtime components
- [0015-identity-and-tenant-architecture.md](./0015-identity-and-tenant-architecture.md) - Tenant system
