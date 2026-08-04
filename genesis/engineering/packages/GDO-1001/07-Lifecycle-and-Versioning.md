# 07 Lifecycle and Versioning

Lifecycle states:

- DRAFT
- IN_REVIEW
- APPROVED
- ACTIVE
- ARCHIVED
- RETIRED

Lifecycle transitions are validated and fail closed on invalid moves.

Versioning:

- document revisions are immutable history
- current revision pointer tracks latest canonical state
