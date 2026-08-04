# 05 Versioning and Checksum Model

Versioning model:

- Sequential version append per asset
- currentVersionId pointer maintained
- Immutable version records with metadata and creator attribution

Checksum model:

- Supported algorithms: SHA256, SHA512
- Integrity verification compares expected digest to canonical stored digest
- Metrics track verification attempts and failures
