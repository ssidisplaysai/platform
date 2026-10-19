# AWS RDS CA bundle

`aws-rds-global-bundle.pem` is the official AWS RDS global trust bundle, pinned
in the PostgreSQL certification image at
`/app/certs/rds-global-bundle.pem`. It provides the trust anchors needed to
validate the staging RDS server certificate chain; it is public trust material,
not a secret.

Source: <https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem>

SHA-256: `fe45bbebf92ad3e27a583bbb2ddd1553c521ed4d49af5514dc0a40372ea5395c`

The image build copies this repository-pinned file. The certification task does
not download trust material at runtime.
