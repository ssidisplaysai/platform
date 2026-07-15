# Specification Template

Use this template when creating new Genesis specifications.
Copy this file, replace the bracketed sections with your content, and follow the conventions defined in SPEC-0000.

---

# [SPEC-XXXX]: [Full Title of Your Specification]

**Identifier**: [SPEC-XXXX or FAMILY-XXXX]  
**Title**: [Complete, descriptive title]  
**Version**: [1.0.0 for first draft]  
**Status**: Draft  
**Classification**: Specification Registry | Informative Reference  
**Type**: [Formal Specification | Reference | ADR | etc.]  

**Created**: [ISO 8601 date, e.g., 2026-07-14]  
**Last Updated**: [ISO 8601 date]  

---

## 1. Purpose

[One or two paragraphs describing why this specification exists, what problem it solves, and what authoritative guidance it provides. This section must be clear enough that a reader immediately understands the specification's reason for being.]

[Example: "GCS-0001 exists to formally specify the eight-stage Genesis Compiler Pipeline as the canonical transformation system. It establishes pipeline contracts, invariants, and trust boundaries that all compiler implementations must respect. GCS-0001 does not define individual stage semantics; that is governed by family-specific specifications."]

---

## 2. Scope

### 2.1 In Scope

[Bullet list of topics this specification covers.]

- Topic 1
- Topic 2
- Topic 3

[Example: "GCS-0001 covers:
- Eight pipeline stages and stage responsibilities
- Stage input/output contracts
- Cross-cutting principles (determinism, immutability, etc.)
- Trust boundaries and validation points"]

### 2.2 Out of Scope

[Explicit list of what this specification does NOT cover. This prevents scope creep and clarifies boundaries.]

- Topic that is explicitly NOT covered
- Topic that belongs in another specification
- Topic that is implementation-specific

[Example: "GCS-0001 does not cover:
- Individual compiler pass semantics (see family-specific specifications)
- Runtime execution model (see GRT specifications when created)
- Code generation details (see implementation standards)
- Specific programming language constraints"]

### 2.3 Relationship to Other Specifications

[If this specification depends on or conflicts with other specifications, clarify the relationship here.]

[Example: "GCS-0001 is normatively dependent on GRA-1.0 (Reference Architecture) for architectural layers and GBS-1.0 (Business Semantics) for canonical concept definitions. GCS-0001 is upstream of all family-specific compiler specifications (GCC-0001, BGC-0001)."]

---

## 3. Definitions

[Define all key terms used in this specification. Distinguish between:
- NORMATIVE definitions (used in SHALL/MUST statements)
- INFORMATIVE definitions (used in rationale or examples)]

### 3.1 Normative Definitions

**Term 1**: [Definition]  
**Term 2**: [Definition]  
**Term 3**: [Definition]  

[Example:
**Deterministic Transformation**: A transformation is deterministic if identical input always produces byte-for-byte identical output across platforms, languages, and time.

**Immutable Artifact**: An artifact is immutable if it cannot be modified after creation. New transformations create new artifacts; previous artifacts remain unchanged.]

### 3.2 Informative Definitions (Guidance, Not Mandatory)

[Define terms used informally in examples or rationale, but not in normative requirements.]

---

## 4. Normative Requirements

[Core requirements for conformance. Use SHALL, MUST, REQUIRED, MUST NOT, SHALL NOT, PROHIBITED.
Every normative requirement must be testable and verifiable.]

### 4.1 [Requirement Category 1]

The system MUST [specific requirement].

[Rationale: Explain why this requirement exists. Reference Genesis First Principles, upstream specifications, or proven practice.]

The system SHALL [verifiable requirement].

[Example: "The compiler SHALL execute passes in deterministic order as specified in the pipeline. This requirement ensures reproducible builds across environments and time."]

### 4.2 [Requirement Category 2]

All [artifacts] MUST [property].

[Example: "All compiler artifacts MUST include provenance metadata linking them to upstream sources. This requirement ensures auditability and traceability."]

---

## 5. Architecture or Model

[Describe the architecture, model, or conceptual structure this specification governs. Use diagrams, tables, or narratives as appropriate.]

### 5.1 Conceptual Model

[Text description of the model]

### 5.2 Visual Representation

[ASCII diagram, Mermaid diagram, or table showing structure]

```
Example:
  Input Stage 1 → Process A → Intermediate State
         ↓                            ↓
      Contract 1                  Validation
         ↓                            ↓
  Input Stage 2 → Process B → Output
```

### 5.3 Data Structures

[If this specification defines data structures, formally specify them. Example using pseudocode or TypeScript interfaces:]

```typescript
/**
 * Normative: This structure represents [concept]
 */
interface SpecificationConcept {
  /**
   * REQUIRED: Unique identifier for this concept
   */
  readonly id: string;

  /**
   * REQUIRED: Human-readable title
   */
  readonly title: string;

  /**
   * OPTIONAL: Additional metadata (MAY be extended by implementations)
   */
  readonly metadata?: Record<string, unknown>;
}
```

---

## 6. Contracts and Invariants

[Formally specify what must be true about inputs, outputs, and system behavior.]

### 6.1 Input Contracts

[What inputs must satisfy before processing]

- Input MUST [property]
- Input MUST NOT [property]
- Input identifiers MUST [be validated by]

### 6.2 Output Contracts

[What outputs guarantee]

- Output SHALL [property]
- Output SHALL NOT [property]
- Output versions SHALL be [immutable | versioned]

### 6.3 System Invariants

[What must always be true during operation]

- Invariant 1: [Description]
- Invariant 2: [Description]

[Example:
- Invariant: Pipeline artifact history MUST never be modified
- Invariant: Stage N output MAY ONLY be consumed by Stage N+1
- Invariant: Determinism MUST be maintained across equivalent inputs]

---

## 7. Compliance Requirements

[How conformance to this specification is verified and certified.]

### 7.1 Conformance Criteria

[Define what it means for an implementation to conform to this specification.]

An implementation conforms to this specification if and only if:
1. [Normative requirement 1 is satisfied]
2. [Normative requirement 2 is satisfied]
3. [All invariants are maintained]

### 7.2 Verification Methods

[How conformance is tested]

- Method 1: [Automated test / Manual verification / Audit]
- Method 2: [Automated test / Manual verification / Audit]

### 7.3 Certification Gate

[Who approves implementations as conformant? What evidence is required?]

[Example: "Conformance certification requires:
- Successful execution of canonical test suite
- Independent verification by Compiler Architecture Board
- Zero open issues in conformance audit
- Documented rationale for any deviations"]

---

## 8. Informative Rationale

[Explanation of why this specification was designed this way. This section is informative (not normative) but crucial for understanding and future evolution.]

### 8.1 Design Rationale

[Why were these choices made?]

### 8.2 Alternatives Considered

[What other approaches were evaluated and why were they rejected?]

### 8.3 Known Limitations

[What does this specification not address? What challenges remain open?]

[Example: "Design Rationale: The eight-stage pipeline balances comprehensive verification (requiring multiple transformation points) against pipeline complexity. Fewer stages would reduce verification opportunities; more stages would increase context-switching overhead. Eight stages aligns with proven Enterprise System patterns.

Known Limitations: Current spec does not address stage parallelization or conditional stage execution. Future versions may extend to address incremental compilation patterns."]

---

## 9. Examples

[Concrete examples demonstrating how this specification is used. Examples are informative, not normative, but they greatly aid understanding.]

### 9.1 [Example 1: Basic Case]

[Description of scenario]

[Code, flow diagram, or narrative showing how specification applies]

### 9.2 [Example 2: Complex Case]

[Description of scenario with edge cases or interactions]

---

## 10. References

### 10.1 Normative References

[Specifications that this specification normatively depends on. These are required for conformance.]

- [SPEC-XXXX]: [Title] (version)
- Genesis Constitution
- [Other authoritative references]

### 10.2 Informative References

[Supporting documentation that provides context but is not required for conformance]

- [Reference 1]
- [Reference 2]

### 10.3 Related Specifications

[Specifications that are related but not direct dependencies]

- [SPEC-YYYY]: [Title] (version) - [relationship]

---

## 11. Dependency Declaration

**This specification depends on** (list all upstream specifications):
- [Upstream Spec 1] - [what is required from it]
- [Upstream Spec 2] - [what is required from it]

**Downstream specifications that depend on this**:
- [Downstream Spec 1] - [what it depends on us for]
- [Downstream Spec 2] - [what it depends on us for]

**Specification Conflicts**: [None known | Note any specifications that conflict with this one and require governance resolution]

---

## 12. Amendment and Versioning

[How will this specification evolve?]

### 12.1 Version History

| Version | Date | Author | Status | Changes |
|---|---|---|---|---|
| 1.0.0 | [Date] | [Author] | Draft | Initial specification |

### 12.2 Amendment Process

[Specify who can propose amendments and what approval is required]

[Example: "Amendments to this specification require:
1. Author submits proposed change with impact analysis
2. Review by Compiler Architecture Board (2-3 weeks)
3. Board decision (approve, conditional, return for revision, or reject)
4. If approved: new version published, git tag applied
5. Registry updated"]

### 12.3 Backward Compatibility Policy

[Is this version backward compatible with previous versions? What compatibility guarantees are provided for future versions?]

[Example: "This specification is the first version (1.0.0). Future 1.x versions will be backward compatible. Breaking changes will increment major version to 2.0.0 with migration guidance."]

---

## Appendix A: [Title]

[Supporting material, detailed tables, optional extensions, or deep-dive examples that are informative but not required for core understanding.]

---

## Appendix B: [Title]

[Additional appendix if needed]

---

**End of Specification Template**

---

## Notes for Specification Authors

1. **Replace all bracketed sections** [like this] with your content
2. **Status field**: During GSP-0000 bootstrap, use "Draft"  
3. **Authority and Owner**: Do NOT invent governance bodies. Leave TBD until GSP-0001 defines governance structure.
4. **Use MUST/SHALL for normative**, MAY/SHOULD for guidance
5. **Keep "Out of Scope" explicit** - it prevents scope creep
6. **Separate Normative from Informative** - use clear language markers
7. **Define all technical terms** - don't assume shared understanding
8. **Describe contracts and invariants formally** - these are verifiable
9. **Include examples** - they clarify ambiguous normative language
10. **Cite upstream specifications** - make dependency clear
11. **Version carefully** - major versions are breaking, minor are compatible, patch is editorial
12. **Submit for review early** - before final publication

## Sections You May Omit

- If specification has no data structures, omit Section 5.3
- If no alternatives were considered, omit Section 8.2
- If specification has no architectural diagram, omit Section 5.2
- Keep sections to reflect the scope and complexity of your specification

## Review Checklist Before Submitting

- [ ] All sections appropriately filled
- [ ] Purpose is clear (1-2 paragraphs max)
- [ ] Scope section explicitly states what is IN and OUT
- [ ] All normative terms defined in Section 3
- [ ] All SHALL/MUST statements are testable
- [ ] Informative vs normative sections are clearly marked
- [ ] All dependencies declared
- [ ] Examples provided to clarify ambiguous language
- [ ] References are complete and correctly cited
- [ ] Version number is appropriate (1.0.0 for new, 1.1.0 for minor, 2.0.0 for major)
- [ ] Status is Draft (if newly created) or Candidate (if ready for formal review)
- [ ] No Foundation specifications modified
- [ ] No runtime/compiler code modified
- [ ] Specification is additive only (no deletions from existing specs)

## Questions Before Final Submission

- What problem does this specification solve?
- Who is the audience? (Implementers, architects, governance?)
- What must be true for conformance?
- What could break conformance?
- What is explicitly not covered?
- What will this enable in the future?
- Are there any known conflicts with existing specifications?

---

**For questions about the template or specification process, see SPEC-0000: Genesis Specification Index**
