# 07 Product Integration Architecture

Product remains the authoritative design source.

Manufacturing contracts required:
- Product validation
- Product Variant validation
- Product Version validation
- BOM validation
- routing/process definition reference validation where applicable
- Product configuration validation
- Product lifecycle usability validation

Retained execution references or snapshots may include:
- Product ID
- Variant ID
- Version ID
- BOM ID/version
- approved execution-relevant version metadata
- validation timestamp
- contract version

Execution rule:
- Manufacturing may retain immutable execution snapshots for traceability
- Manufacturing may not copy Product canonical records wholesale
- Product BOM changes after Work Order release do not retroactively rewrite approved execution baseline
- if Product changes after release, execution remains traceable to the approved source version captured at release or plan freeze

Validation sequence:
1. validate Product and Product Variant where applicable
2. validate Product Version
3. validate BOM reference/version
4. validate routing/process reference if present
5. capture immutable execution snapshot
6. freeze approved baseline for Work Order execution
7. derive execution requirements and trace links
