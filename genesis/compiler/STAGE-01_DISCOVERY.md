# STAGE-01: Genesis Discovery Engine

**Stage**: 1 of 8  
**Name**: Discovery  
**Purpose**: Capture enterprise reality into immutable Evidence IR  
**Input**: Enterprise sources (PDFs, interviews, documents)  
**Output**: Evidence IR (JSON)  
**Specification**: GCS-0001  

---

## 1. Purpose

The **Discovery Stage** transforms unstructured enterprise sources into structured, immutable **Evidence IR**.

This is where reality enters the Genesis pipeline. Everything that follows depends on the quality and completeness of Evidence IR.

### Core Responsibilities

1. **Source Registration**: Identify and register all sources
2. **Evidence Extraction**: Extract facts from sources (no inference)
3. **Provenance Preservation**: Track complete lineage to source
4. **Deterministic Ordering**: Ensure reproducible processing
5. **Immutable Recording**: Create permanent Evidence IR

---

## 2. Inputs

### 2.1 Input Format

**Type**: Enterprise source documents  
**Formats**: PDF, interviews, transcripts, documents  
**Structure**: Unstructured or semi-structured text  
**Encoding**: UTF-8  

### 2.2 Input Properties

Each source MUST have:

| Property | Type | Required | Purpose |
|----------|------|----------|---------|
| **sourceId** | string | Yes | Unique identifier for source |
| **sourceType** | enum | Yes | Type of source (pdf, interview, document, etc.) |
| **sourceDate** | ISO 8601 | Yes | When source was created |
| **participant** | string | Conditional | For interviews: who was interviewed |
| **interviewer** | string | Conditional | For interviews: who conducted interview |
| **content** | bytes | Yes | Raw document content |
| **metadata** | object | No | Additional metadata |

### 2.3 Input Validation

Before processing, validate:

```
✓ Source exists and is readable
✓ Content is not empty
✓ Format is supported
✓ Encoding is UTF-8 (or can be converted)
✓ File integrity (checksum if provided)
```

---

## 3. Outputs

### 3.1 Output Artifacts

Discovery Stage produces three artifacts:

#### 3.1.1 Document JSON

**Purpose**: Raw parsed document  
**Format**: JSON  
**Schema**: DiscoveryDocument  

```json
{
  "documentId": "doc_<hash>_v1",
  "sourceId": "source_<hash>_v1",
  "sourceType": "pdf",
  "pages": [
    {
      "pageNumber": 1,
      "content": "...",
      "blocks": [
        {
          "blockId": "block_<hash>_v1",
          "type": "text|header|list|table",
          "content": "..."
        }
      ]
    }
  ],
  "metadata": {
    "created": "2026-07-10T00:00:00Z",
    "discoveryVersion": "1.0"
  }
}
```

#### 3.1.2 Interview JSON

**Purpose**: Structured interview questions and answers  
**Format**: JSON  
**Schema**: DiscoveryInterview  

```json
{
  "interviewId": "interview_<hash>_v1",
  "sourceId": "source_<hash>_v1",
  "participant": "Name",
  "role": "Title",
  "department": "Department",
  "sections": [
    {
      "sectionId": "section_<hash>_v1",
      "title": "Section Title",
      "questions": [
        {
          "id": "question_<hash>_v1",
          "page": 1,
          "question": "What is...?",
          "answer": "Answer text here",
          "confidence": 0.95
        }
      ]
    }
  ],
  "metadata": {
    "created": "2026-07-10T00:00:00Z",
    "discoveryVersion": "1.0"
  }
}
```

#### 3.1.3 Result JSON

**Purpose**: Full compilation result with diagnostics  
**Format**: JSON  
**Schema**: DiscoveryResult  

```json
{
  "success": true,
  "sourceId": "source_<hash>_v1",
  "documentId": "doc_<hash>_v1",
  "interviewId": "interview_<hash>_v1",
  "statistics": {
    "pagesProcessed": 10,
    "questionsExtracted": 22,
    "answersExtracted": 22,
    "textPreserved": 4828
  },
  "diagnostics": [
    {
      "code": "DIS_101",
      "severity": "info",
      "message": "Document loaded successfully"
    }
  ],
  "manifest": {
    "compilerVersion": "1.0",
    "executionTimeMs": 145,
    "validationSummary": {
      "totalValidations": 22,
      "passed": 22,
      "failed": 0
    }
  }
}
```

### 3.2 Output Properties

All outputs MUST have:

| Property | Value | Purpose |
|----------|-------|---------|
| **deterministic** | true | Identical input = identical output |
| **immutable** | true | Never modified after creation |
| **identity** | GPS-0001 format | Derived from content hash |
| **version** | v1 | Schema version |
| **created** | ISO 8601 | When created |
| **provenance** | complete | Traces to source |

---

## 4. Invariants

### Stage 1 Invariants (I1-x)

| ID | Invariant | Definition |
|----|-----------|-----------|
| **I1.1** | Immutability | Evidence IR is never modified after creation |
| **I1.2** | Provenance | Every evidence item traces to source |
| **I1.3** | Completeness | No text is lost from source |
| **I1.4** | Determinism | Identical input → identical identities |
| **I1.5** | No Inference | Only facts extracted, no reasoning |
| **I1.6** | No Classification** | Facts not classified or labeled |
| **I1.7** | No Summation | Complete text preserved |
| **I1.8** | Ordering | Questions/answers in source order |

### Enforcement Mechanisms

**I1.1** (Immutability): Schema prevents modification  
**I1.2** (Provenance): Every item includes source references  
**I1.3** (Completeness): Input/output text length verification  
**I1.4** (Determinism): Identical hashes for identical content  
**I1.5-8**: Validation rules prevent violations  

---

## 5. Deterministic Guarantees

### 5.1 Byte-for-Byte Determinism

For identical input:

```
✓ Same document JSON structure
✓ Same page count
✓ Same block count
✓ Same text content (Unicode NFC normalized)
✓ Same identities (SHA-256 hashing)
✓ Same order (pages, blocks, questions)
✓ Same diagnostics (same codes, same order)
```

### 5.2 Identity Generation

```
Question Identity = evidence_item_<hash>_v1

hash = SHA-256(
  JSON.stringify({
    formType: "statement",
    rawContent: canonicalize(answer_text),
    provenance: {
      questionId,
      answerId,
      sectionId,
      interviewId
    }
  })
)
```

### 5.3 Processing Order

```
1. Load source
2. Parse pages (in order)
3. Extract blocks (in order)
4. Group into sections (in order)
5. Extract questions/answers (in order)
6. Generate identities (deterministic)
7. Validate (non-destructive)
8. Export JSON (canonical format)
```

---

## 6. Diagnostics

### 6.1 Diagnostic Codes

| Code | Level | Meaning |
|------|-------|---------|
| **DIS_001** | Info | Source loaded successfully |
| **DIS_002** | Info | Pages parsed |
| **DIS_003** | Info | Sections detected |
| **DIS_010** | Info | Questions extracted |
| **DIS_020** | Warning | Incomplete extraction |
| **DIS_030** | Error | Parse failure |
| **DIS_040** | Error | Encoding error |

### 6.2 Diagnostic Output

Every run produces:

```
{
  "diagnostics": [
    {
      "code": "DIS_001",
      "severity": "info",
      "message": "Source loaded successfully",
      "timestamp": "2026-07-10T00:00:00Z"
    },
    ...
  ],
  "summary": {
    "infos": 5,
    "warnings": 0,
    "errors": 0
  }
}
```

---

## 7. Failure Conditions

### 7.1 Fatal Failures (Stop)

| Condition | Symptom | Action |
|-----------|---------|--------|
| **Source not found** | File missing | Halt, report error |
| **Unsupported format** | Format unknown | Halt, report error |
| **Encoding error** | Cannot decode UTF-8 | Halt, report error |
| **Parser crash** | Exception thrown | Halt, report error |

### 7.2 Major Failures (Skip)

| Condition | Symptom | Action |
|-----------|---------|--------|
| **Partial parse** | Some pages fail | Record diagnostic, continue |
| **Question extraction** | Some Q/A fail | Record diagnostic, continue |
| **Block classification** | Some blocks fail | Record diagnostic, continue |

### 7.3 Minor Failures (Warn)

| Condition | Symptom | Action |
|-----------|---------|--------|
| **Non-standard encoding** | BOMs or special chars | Normalize, record diagnostic |
| **Malformed metadata** | Missing metadata | Use defaults, record diagnostic |

---

## 8. Trust Boundary (B1, B2)

### 8.1 What We Trust About Reality

**Trust Boundary B1**: Reality → Stage 1

We **trust** that:
- Source documents are authentic
- Content has not been tampered with
- Metadata is reasonably accurate
- Format is as declared

We **do NOT trust**:
- Content is correct (facts are verified in later stages)
- Content is complete
- Content is unbiased

### 8.2 What Stage 2 Trusts About Stage 1

**Trust Boundary B2**: Stage 1 → Stage 2

Stage 2 **trusts** that:
- Evidence IR is well-formed JSON
- All identities follow GPS-0001 format
- All content is immutable
- All provenance is complete and traceable
- All text is unchanged from source
- All ordering is preserved

---

## 9. Validation Requirements

### 9.1 Input Validation

Before processing, validate:

```
Schema DIS_InputValidation:
  ✓ source.sourceId exists and is non-empty
  ✓ source.sourceType is recognized
  ✓ source.content is non-empty
  ✓ source.content can be decoded as UTF-8
  ✓ file size is within limits
  ✓ file format matches declared type
```

### 9.2 Output Validation

After processing, validate:

```
Schema DIS_OutputValidation:
  ✓ documentId is valid GPS-0001 identity
  ✓ interviewId is valid GPS-0001 identity
  ✓ all questionIds are valid identities
  ✓ all provenance fields are present
  ✓ text length matches source
  ✓ JSON is parseable
  ✓ all pages present
  ✓ all questions/answers paired
```

### 9.3 Validation Rules

```
Rule DIS_R01: Text Preservation
  For every source block:
    length(output_text) == length(input_text)
    output_text == input_text (after normalization)

Rule DIS_R02: Ordering
  For every section:
    questions[i].position < questions[i+1].position

Rule DIS_R03: Completeness
  For every extracted question:
    question.answer != empty
    question.id is deterministic

Rule DIS_R04: Identity
  For every evidence item:
    identity matches format: evidence_item_<hash>_v1
    hash is 64 hex characters
```

---

## 10. Metrics

### 10.1 Processing Metrics

| Metric | Purpose | Type |
|--------|---------|------|
| **executionTimeMs** | Total processing time | milliseconds |
| **pagesProcessed** | Number of pages parsed | count |
| **blocksExtracted** | Number of blocks identified | count |
| **questionsExtracted** | Number of Q/A pairs | count |
| **textPreserved** | Characters from source | count |
| **identitiesGenerated** | New identities created | count |

### 10.2 Quality Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| **Text Preservation** | 100% | Verify no data loss |
| **Validation Pass Rate** | 100% | Verify quality |
| **Determinism** | 100% | Verify reproducibility |
| **Extraction Completeness** | ≥ 95% | Identify missed content |

### 10.3 Diagnostic Metrics

| Metric | Meaning |
|--------|---------|
| **Info Messages** | Expected observations |
| **Warning Messages** | Unusual but valid |
| **Error Messages** | Violations detected |

---

## 11. Relationship to Adjacent Stages

### 11.1 Input from Reality (Backward)

```
Reality
  ↓ (provides sources)
Stage 1: Discovery
  ↑ (Trust Boundary B1)
  
Stage 1 expects:
  - Authentic source documents
  - Consistent encoding
  - Reasonable metadata
```

### 11.2 Output to Stage 2 (Forward)

```
Stage 1: Discovery
  ↓ (produces Evidence IR)
Stage 2: Evidence Compiler
  ↑ (Trust Boundary B2)
  
Stage 2 expects:
  - Well-formed Evidence IR
  - Complete provenance
  - Deterministic identities
  - Immutable content
```

---

## 12. Implementation Notes

### 12.1 Required Components

```
PdfRawParser
  - Parses PDF structure
  - Extracts pages and blocks
  - Preserves text exactly

InterviewParser
  - Detects section structure
  - Identifies Q/A patterns
  - Maintains ordering

DiscoveryValidator
  - Validates input format
  - Validates output schema
  - Checks invariants

DiscoveryExporter
  - Generates Document JSON
  - Generates Interview JSON
  - Generates Result JSON
```

### 12.2 Dependencies

```
- pdf-parse (PDF library)
- GPS-0001 (identity generation)
- GPS-0002 (canonicalization)
```

---

## 13. Example Execution

### Input
```
source.pdf (10 pages, 4,828 characters)
participant: "Zach Anderson"
role: "Graphics Lead"
```

### Processing
```
1. Load PDF → DiscoveryDocument
2. Parse sections → 5 sections
3. Extract questions → 22 questions
4. Generate identities → Deterministic IDs
5. Validate output → All rules pass
6. Export JSON → Three artifacts
```

### Output
```
Document JSON: Zach_Discovery_Interview.document.json
Interview JSON: Zach_Discovery_Interview.interview.json
Result JSON: Zach_Discovery_Interview.result.json

Diagnostics:
  - DIS_001: Source loaded ✓
  - DIS_002: Pages parsed ✓
  - DIS_003: Sections detected ✓
  - DIS_010: Questions extracted ✓

Statistics:
  - Pages: 10 ✓
  - Questions: 22 ✓
  - Text preserved: 4,828/4,828 (100%) ✓
```

---

## 14. Specification Status

**Version**: 1.0  
**Date**: 2026-07-10  
**Status**: SPECIFICATION  
**Implementation**: Stage 1 Discovery Engine (implemented)  
**Validation**: Both real interviews processed successfully  
**Certification**: STAGE 1 VALIDATED ✓  

---

**STAGE-01: Discovery Engine**  
**Part of GCS-0001 Genesis Compiler Specification**
