# 10 Reference Model

Reference-only relationship model:

1. Asset references
- Product stores AssetReference linkage only.
- Asset binary custody remains with Asset Platform.

2. Document references
- Product stores DocumentReference linkage only.
- Document custody/revision authority remains with Document Platform.

3. Knowledge references
- Product stores KnowledgeReference linkage only.
- Knowledge semantic governance remains with Knowledge Platform.

4. Organization references
- Product stores OrganizationReference linkage only.
- Organization identity authority remains with Organization Platform.

Reference behavior rules:

1. Stable identifiers only.
2. Source ownership retained externally.
3. Contract validation required when reference state is mandatory.
4. Tenant-safe and auditable reference updates required.
5. No foreign state ownership or local canonical duplication permitted.
