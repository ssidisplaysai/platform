# Genesis Commerce Platform Profile Assignment and Inheritance

## Assignment Targets
Profiles can be assigned to:
1. site
2. product
3. category
4. page_template
5. blog_template
6. media

## Assignment Contract
Each assignment includes:
1. assignmentId.
2. organizationId.
3. targetType and targetId.
4. siteId context (nullable where applicable).
5. profileType and profileId.
6. inherited flag metadata.
7. createdAt and updatedAt.
8. notes.

## Inheritance Rules
1. Direct target assignment has highest precedence.
2. If direct assignment is missing, site assignment is used when target has site context.
3. If site assignment is missing, organization default profile is used.
4. If no source exists, effective profile is null.
5. Resolution is deterministic and side-effect free.
