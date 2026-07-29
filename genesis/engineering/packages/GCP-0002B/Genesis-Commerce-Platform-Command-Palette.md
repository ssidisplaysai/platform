# Genesis Commerce Platform Command Palette

## Foundation Purpose
Provide a global shell command surface for fast navigation and future action orchestration.

## Implemented Behavior
1. Shell-level toggle button opens and closes command panel
2. Toggle is disabled when role lacks command_palette:use
3. Command query filters action labels and descriptions
4. Visible commands are constrained by permission requirements
5. Empty-result state is rendered for unmatched queries

## Command Contract
Each command includes:
1. id
2. label
3. description
4. href
5. requiredPermissions

## Current Command Set
1. Open Companies
2. Open Settings
3. Open Notifications
4. Open Audit
5. Open Enterprise Search

## Boundary Notes
This package implements UI and selection logic only. It does not execute privileged side effects, writes, or workflow dispatch.
