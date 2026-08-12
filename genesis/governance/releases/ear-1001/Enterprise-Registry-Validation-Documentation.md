# Enterprise Registry Validation Documentation

Work Order: EAR-1001
Date: 2026-07-30

## Validation Engine

Location: src/platform/ear/validation.ts

## Registration Validation Rules

- unique application IDs
- required identity fields
- semantic version syntax enforcement
- non-empty capability declarations
- unique capability declarations
- required ownership fields
- required metadata description and discovery path
- required compatibility declarations
- health reference completeness

## Lifecycle Validation

Allowed transitions:
- REGISTERED -> ACTIVE, INACTIVE
- ACTIVE -> INACTIVE, DEPRECATED
- INACTIVE -> ACTIVE, DEPRECATED
- DEPRECATED -> none

## Compatibility Validation

Checks:
- registryContractVersion exact support
- optional requiredHealthContractVersion support
- optional requiredCapabilityContractVersion support

## Validation Output

ValidationResult
- valid
- issues[]

Each issue includes:
- field
- code
- message
