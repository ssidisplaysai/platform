# STAGE-06: Blueprint Projection

**Stage**: 6 of 8  
**Name**: Blueprint Projection  
**Purpose**: Project Enterprise Genome into domain-specific architectural blueprints  
**Input**: Enterprise Genome (from Stage 5)  
**Output**: Enterprise Blueprint (domain projections)  
**Specification**: GCS-0001  

---

## 1. Purpose

The **Blueprint Projection** stage creates domain-specific architectural views of the Enterprise Genome.

Each blueprint is a projection optimized for a specific purpose (CRM, ERP, HR, etc.).

### Core Responsibilities

1. **Domain Projection**: Filter genome for specific domain
2. **Module Definition**: Define deployment units
3. **API Contracts**: Specify service interfaces
4. **Data Models**: Define information structures
5. **Workflow Definition**: Specify process flows
6. **UI/UX Projection**: Define user interactions

---

## 2. Inputs

### 2.1 Input Format

**Type**: Enterprise Genome (from Stage 5)  
**Format**: JSON (graphs, entities, relationships)  

### 2.2 Projection Rules

Input must include:
- Domain definitions (CRM, ERP, HR, etc.)
- Entity filtering rules
- Capability mapping rules
- Relationship projection rules
- API exposure rules

---

## 3. Outputs

### 3.1 Output Artifacts

#### 3.1.1 Domain Blueprint

```json
{
  "blueprintId": "blueprint_<hash>_v1",
  "domain": "crm",
  "generatedAt": "2026-07-10T00:00:00Z",
  
  "moduleDefinitions": [
    {
      "moduleId": "module_<hash>_v1",
      "name": "Customer Management",
      "responsibilities": [
        "capability_..."
      ],
      "internalEntities": ["entity_..."],
      "externalInterfaces": ["interface_..."]
    }
  ],
  
  "apiContracts": [
    {
      "apiId": "api_<hash>_v1",
      "name": "Customer API",
      "endpoints": [
        {
          "path": "/customers",
          "method": "GET",
          "input": {"schema": "..."},
          "output": {"schema": "..."}
        }
      ],
      "version": "1.0",
      "consumers": ["module_..."]
    }
  ],
  
  "dataModels": [
    {
      "modelId": "model_<hash>_v1",
      "name": "Customer",
      "fields": [
        {
          "name": "customerId",
          "type": "string",
          "required": true,
          "identity": true
        }
      ]
    }
  ],
  
  "workflows": [
    {
      "workflowId": "workflow_<hash>_v1",
      "name": "Customer Onboarding",
      "steps": [
        {
          "step": 1,
          "action": "Collect customer info",
          "owner": "actor_...",
          "inputs": ["form_data"],
          "outputs": ["customer_record"]
        }
      ]
    }
  ],
  
  "uiProjections": [
    {
      "uiId": "ui_<hash>_v1",
      "name": "Customer Portal",
      "screens": [
        {
          "screenId": "screen_<hash>_v1",
          "name": "Customer Dashboard",
          "widgets": [...]
        }
      ]
    }
  ],
  
  "statistics": {
    "modulesGenerated": 5,
    "apisGenerated": 12,
    "dataModelsGenerated": 8,
    "workflowsGenerated": 6
  }
}
```

---

## 4. Invariants

### Stage 6 Invariants (I6-x)

| ID | Invariant | Definition |
|----|-----------|-----------|
| **I6.1** | Domain Validity | Projections valid for domain |
| **I6.2** | Non-Overlap | Domains don't share entities |
| **I6.3** | Contract Compliance** | APIs satisfy contracts |
| **I6.4** | Completeness** | All entities projected |
| **I6.5** | Consistency** | No contradictions |
| **I6.6** | Determinism | Same genome → same blueprint |

---

## 5. Projection Process

### 5.1 Domain Filtering

```
For each domain (CRM, ERP, HR, ...):
  1. Identify target entities (actors, resources, capabilities)
  2. Filter genome for relevant nodes
  3. Include dependent entities
  4. Mark external dependencies
```

### 5.2 Module Definition

```
For each domain:
  1. Group related capabilities
  2. Define module boundaries
  3. Specify internal/external interfaces
  4. Identify dependencies
```

### 5.3 API Generation

```
For each module:
  1. Extract capabilities that need external access
  2. Define API endpoints
  3. Specify request/response schemas
  4. Document contract
```

### 5.4 Data Model Generation

```
For each domain:
  1. Identify key entities
  2. Define fields from genome data
  3. Establish relationships
  4. Add validation rules
```

---

## 6. Metrics

### 6.1 Blueprint Metrics

| Metric | Purpose |
|--------|---------|
| **modulesGenerated** | Count of deployment units |
| **apisGenerated** | Service interfaces |
| **dataModelsGenerated** | Information structures |
| **workflowsGenerated** | Business processes |
| **integrationPoints** | Cross-domain connections |

---

## 7. Trust Boundary (B6, B7)

### 7.1 Trust About Genome (B6)

We **trust**:
- Genome is complete
- No dangling references
- Graphs are valid

### 7.2 Trust for Stage 7 (B7)

Stage 7 **trusts**:
- Blueprint is valid for code generation
- All APIs are specified
- All data models are defined
- All workflows are executable

---

## 8. Determinism

```
✓ Same genome → same blueprint
✓ Same module definitions
✓ Same API contracts
✓ Same data models
✓ Same workflows
```

---

## 9. Domain Examples

### CRM Domain
- Entities: Customer, Contact, Opportunity, Account
- Capabilities: Record customer, Track opportunity, Send communication
- Workflows: Lead → Opportunity → Deal, Support ticket handling
- APIs: Customer search, Opportunity CRUD, Communication log

### ERP Domain
- Entities: Product, Purchase Order, Invoice, Supplier
- Capabilities: Record product, Process order, Generate invoice
- Workflows: Order fulfillment, Supplier management
- APIs: Product catalog, Order management, Financial records

### HR Domain
- Entities: Employee, Position, Department, Payroll
- Capabilities: Hire employee, Track performance, Process payroll
- Workflows: Recruitment, Performance review, Compensation
- APIs: Employee directory, Performance tracking, Payroll

---

**STAGE-06: Blueprint Projection**  
**Part of GCS-0001 Genesis Compiler Specification**
