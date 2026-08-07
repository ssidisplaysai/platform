# 09 Work Center Machine and Labor Boundary

## Manufacturing Operational Resource Ownership

Manufacturing owns operational execution state for:
- Work Center
- Production Cell
- Machine Assignment
- Tool Assignment
- execution-capacity metadata

## Asset Identity Separation

Where Asset Platform is canonical for physical asset identity and custody, Manufacturing stores asset references and owns assignment and execution state only.

## Labor Boundary

Manufacturing may own:
- labor assignment to production execution
- operator role reference during work execution
- labor-time execution facts

Manufacturing must not own:
- Person
- Employee
- Contact
- Organization
- HR authority
- authentication identity

Manufacturing stores references only for foreign identity records.
