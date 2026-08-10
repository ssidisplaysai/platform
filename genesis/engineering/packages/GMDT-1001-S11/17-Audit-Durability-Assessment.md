# Audit Durability Assessment

Save-success audit evidence is modeled as post-commit volatile evidence until the next durable checkpoint. The implementation avoids recursive save/audit/save behavior and the package documents this semantics explicitly.
