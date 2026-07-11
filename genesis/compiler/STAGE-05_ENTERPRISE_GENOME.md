# STAGE-05: Enterprise Genome Assembly

**Stage**: 5 of 8  
**Name**: Enterprise Genome Assembly  
**Purpose**: Assemble canonical EKOs into unified Enterprise Genome  
**Input**: Canonical EKOs (from Stage 4)  
**Output**: Enterprise Genome (comprehensive enterprise model)  
**Specification**: GCS-0001  

---

## 1. Purpose

The **Enterprise Genome Assembly** stage creates a unified, comprehensive model of the enterprise from canonical EKOs.

The Enterprise Genome is the single source of truth for enterprise structure and capabilities.

### Core Responsibilities

1. **Identity Graph**: Who/what exists in the enterprise
2. **Capability Graph**: What the enterprise can do
3. **Relationship Graph**: How things connect
4. **Organizational Structure**: Hierarchy and roles
5. **Behavioral Structure**: How systems behave
6. **Policy Graph**: Rules and constraints

---

## 2. Inputs

### 2.1 Input Format

**Type**: Canonical EKOs (from Stage 4)  
**Format**: JSON  

```json
{
  "ekos": [
    {
      "ekoId": "eko_<hash>_v1",
      "type": "capability|actor|resource|...",
      "canonicalConcept": "...",
      "gbsMapping": "gbs_001_...",
      "relationships": {
        "relatedEKOs": ["eko_...", "eko_..."]
      }
    }
  ]
}
```

---

## 3. Outputs

### 3.1 Output Artifacts

#### 3.1.1 Enterprise Genome

```json
{
  "genomeId": "genome_<hash>_v1",
  "generatedAt": "2026-07-10T00:00:00Z",
  
  "identityGraph": {
    "actors": [
      {
        "actorId": "actor_<hash>_v1",
        "name": "Designer",
        "role": "Creative Lead",
        "capabilities": ["eko_...", "eko_..."],
        "constraints": ["eko_...", "eko_..."]
      }
    ],
    "resources": [
      {
        "resourceId": "resource_<hash>_v1",
        "name": "Graphics System",
        "owners": ["actor_..."],
        "capabilities": ["eko_...", "eko_..."]
      }
    ]
  },
  
  "capabilityGraph": {
    "capabilities": [
      {
        "capabilityId": "capability_<hash>_v1",
        "name": "Design Graphics",
        "performers": ["actor_..."],
        "inputs": ["resource_..."],
        "outputs": ["resource_..."],
        "relatedCapabilities": ["capability_...", "capability_..."]
      }
    ]
  },
  
  "relationshipGraph": {
    "edges": [
      {
        "edgeId": "rel_<hash>_v1",
        "fromId": "actor_...",
        "toId": "actor_...",
        "relationType": "reports_to|collaborates_with|owns|...",
        "metadata": {...}
      }
    ]
  },
  
  "organizationalStructure": {
    "hierarchy": [
      {
        "level": 1,
        "title": "Executive",
        "actors": ["actor_..."]
      }
    ],
    "departments": [
      {
        "departmentId": "dept_<hash>_v1",
        "name": "Design",
        "members": ["actor_..."],
        "capabilities": ["capability_..."]
      }
    ]
  },
  
  "behavioralStructure": {
    "processes": [
      {
        "processId": "process_<hash>_v1",
        "name": "Design Review",
        "steps": [
          {
            "stepId": "step_<hash>_v1",
            "action": "capability_...",
            "performer": "actor_...",
            "inputs": ["resource_..."],
            "outputs": ["resource_..."]
          }
        ]
      }
    ]
  },
  
  "policyGraph": {
    "policies": [
      {
        "policyId": "policy_<hash>_v1",
        "name": "Data Access",
        "rules": [
          {
            "ruleId": "rule_<hash>_v1",
            "condition": "actor has role X",
            "action": "can access resource Y",
            "enforcement": "must|should|optional"
          }
        ]
      }
    ]
  },
  
  "statistics": {
    "totalActors": 15,
    "totalResources": 23,
    "totalCapabilities": 42,
    "totalRelationships": 87,
    "totalProcesses": 12,
    "totalPolicies": 18
  }
}
```

#### 3.1.2 Genome Manifest

```json
{
  "manifestId": "manifest_<hash>_v1",
  "sourceEKOs": 42,
  "graphsGenerated": {
    "identity": 38,
    "capability": 42,
    "relationship": 87,
    "organizational": 15,
    "behavioral": 12,
    "policy": 18
  },
  "validations": {
    "graphConsistency": "✓ valid",
    "referentialIntegrity": "✓ valid",
    "policyCompliance": "✓ compliant",
    "completeness": "✓ complete"
  }
}
```

---

## 4. Invariants

### Stage 5 Invariants (I5-x)

| ID | Invariant | Definition |
|----|-----------|-----------|
| **I5.1** | Graph Consistency** | No contradictions in graphs |
| **I5.2** | Referential Integrity | All references valid |
| **I5.3** | Completeness** | All entities represented |
| **I5.4** | Determinism | Same input → same genome |
| **I5.5** | Identity Authority | Identity graph is authoritative |
| **I5.6** | Immutability | Genome structure immutable |

---

## 5. Graph Construction

### 5.1 Identity Graph

```
Nodes: Actors, Resources, Concepts
Edges: has, owns, belongs_to

Construction:
  1. Extract all Actor EKOs
  2. Extract all Resource EKOs
  3. Extract relationships from EKOs
  4. Create actor nodes
  5. Create resource nodes
  6. Create edges based on relationships
```

### 5.2 Capability Graph

```
Nodes: Capabilities
Edges: requires, enables, blocks, depends_on

Construction:
  1. Extract all Capability EKOs
  2. Extract all Constraint EKOs
  3. Identify capability relationships
  4. Create capability nodes
  5. Create dependency edges
  6. Mark constraints
```

### 5.3 Relationship Graph

```
Nodes: All entities (actors, resources, capabilities, processes)
Edges: all relationships

Types: reports_to, owns, collaborates, manages, uses, produces, etc.

Construction:
  1. Extract all relationship EKOs
  2. Resolve entity references
  3. Create nodes for all entities
  4. Create typed edges
  5. Assign relationship metadata
```

### 5.4 Organizational Structure

```
Hierarchy: Level-based organizational structure
  - Executive
  - Management
  - Teams
  - Individual Contributors

Construction:
  1. Extract hierarchy information from Actor EKOs
  2. Group actors by level
  3. Assign departments
  4. Define reporting relationships
```

### 5.5 Behavioral Structure

```
Processes: Flow of work through organization
  - Process steps
  - Actors involved
  - Resources used
  - Outputs produced

Construction:
  1. Extract Process EKOs
  2. Order steps deterministically
  3. Identify actor/resource usage
  4. Link to capabilities
```

### 5.6 Policy Graph

```
Policies: Business rules and constraints
  - Access policies
  - Operational policies
  - Data policies
  - Workflow policies

Construction:
  1. Extract Policy EKOs
  2. Parse policy rules
  3. Identify conditions and actions
  4. Define enforcement level
  5. Link to affected entities
```

---

## 6. Validation

### 6.1 Graph Validation

```
Rule: No dangling references
  For every edge:
    fromNode exists AND toNode exists

Rule: No circular dependencies (where prohibited)
  For organizational hierarchy:
    No circular reporting chains

Rule: Referential integrity
  For every entity reference:
    Entity exists in appropriate graph

Rule: Policy compliance
  For every actor/resource:
    Must comply with applicable policies
```

---

## 7. Metrics

### 7.1 Genome Metrics

| Metric | Purpose |
|--------|---------|
| **totalActors** | Size of identity graph |
| **totalResources** | Resource inventory |
| **totalCapabilities** | Functional scope |
| **totalRelationships** | Connectivity |
| **graphDensity** | Connections/entities ratio |
| **cycleCount** | Circular dependencies |

---

## 8. Trust Boundary (B5, B6)

### 8.1 Trust About Canonical EKOs (B5)

We **trust**:
- EKOs map to canonical concepts
- Aliases are resolved
- Relationships are valid

### 8.2 Trust for Stage 6 (B6)

Stage 6 **trusts**:
- Genome is complete and consistent
- No dangling references
- Graphs are valid
- Identity graph is authoritative

---

## 9. Determinism

```
✓ Same EKO set → same genome structure
✓ Same graph construction order
✓ Same entity identities
✓ Same relationships
✓ Same statistics
```

---

**STAGE-05: Enterprise Genome Assembly**  
**Part of GCS-0001 Genesis Compiler Specification**
