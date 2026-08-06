# 04 Location And Bin Foundation

Storage Location behavior:

1. register Storage Location with required Warehouse parent
2. enforce one Warehouse parent
3. enforce Location code uniqueness within Warehouse scope
4. prevent recursive containment
5. support approved location types: receiving, storage, picking, staging, quarantine, transfer, virtual
6. enforce lifecycle transitions with expected-version checks
7. retrieve and list Locations deterministically
8. reparent Locations with recursive containment validation
9. update approved metadata
10. emit audit evidence

Bin behavior:

1. register Bin with required Storage Location parent
2. enforce one Location parent
3. enforce Bin code uniqueness within Location scope
4. enforce lifecycle transitions with expected-version checks
5. retrieve and list Bins deterministically
6. update approved capacity metadata
7. emit audit evidence

Deferred explicitly:

1. stock placement
2. physical movement
3. movement-derived occupancy behavior