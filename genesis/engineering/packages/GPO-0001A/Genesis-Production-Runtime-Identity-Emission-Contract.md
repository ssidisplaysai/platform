# Genesis Production Runtime Identity Emission Contract

Status: Future deployment contract; not implemented

## Issuer And Inputs

A separately authorized deployment process is the sole issuer of `ProductionReleaseIdentity`. Inputs are an approved release ID and 40-character commit, deterministic build artifact digest, canonical production root, approved task-definition digest, lifecycle owner, deployment epoch, creation time, and correlation ID.

The target runtime and supervisor cannot issue or modify release identity.

## Canonicalization And Hashing

The issuer validates the JSON Schema, serializes UTF-8 JSON with recursively sorted property names, no insignificant whitespace, and normalized Windows canonical paths. `descriptorHash` is `sha256:` followed by lowercase SHA-256 over the canonical descriptor with `descriptorHash` omitted. A hash is not a signature; ACL and issuer verification remain mandatory.

## Publication

The future destination is an ACL-protected identity directory outside the writable runtime tree. Publication writes a same-directory temporary file, flushes content, applies the expected owner/ACL, validates the complete file, and atomically replaces the current descriptor. Partial or failed publication leaves the previous descriptor and deployment epoch authoritative and fails deployment closed.

## Epoch, Correlation, And Rollback

Emission occurs under the shared lifecycle ownership protocol. The deployment epoch uniquely identifies the approved release generation and is recorded with the deployment correlation ID. Rollback emits a new descriptor for the rollback release at a new deployment epoch; it never republishes an old epoch or edits prior evidence.

## Validation And Failure

Deployment must reject malformed commits, relative paths, unknown properties, forbidden secrets or environment data, unapproved task identity, ACL mismatch, hash mismatch, stale epoch, and non-atomic publication. No descriptor is emitted by OA-00A and no deployment tooling is modified.