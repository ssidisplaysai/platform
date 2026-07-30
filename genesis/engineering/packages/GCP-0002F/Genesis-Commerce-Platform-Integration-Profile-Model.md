# Genesis Commerce Platform Integration Profile Model

## Core Contract
Each integration profile includes:
1. Stable profileId.
2. profileType.
3. organizationId scope.
4. profileName and description.
5. status and enabled flags.
6. version.
7. assignedSiteIds support.
8. defaultForOrganization flag.
9. references object containing opaque reference values.
10. createdAt and updatedAt.
11. notes.

## Profile Types
1. publishing
2. wordpress
3. workflow
4. prompt
5. image
6. seo
7. brand
8. analytics

## Secret Handling
1. Profiles store references only.
2. Secret-like value patterns are rejected by validation.
3. Binary payloads and inline credential values are rejected.

## GCP-0002G Compatibility Note
1. Integration profile contract shape remains unchanged by customer foundation scope.
2. Customer/account/contact/address records consume bounded operational metadata and do not introduce profile secret storage.
3. Cross-surface behavior remains composition-only: profile authority remains external to customer record ownership.
