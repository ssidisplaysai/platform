# GACP-0003 - Platform Bootstrap API Contract

Status: Active
Date: 2026-07-29
Authority: GACD-0003, GACD-0004

## Purpose
Define the public platform bootstrap contract consumed by protected application layout surfaces.

## Public Entry Point
- Module: `src/lib/gop/platform-bootstrap-api.ts`
- Primary function: `initializePlatform(context)`

## Input Contract
`GenesisPlatformBootstrapContext`
- `subject`: `GenesisAuthorizationSubject`

## Output Contract
`GenesisPlatformBootstrapResult`
- `workspace`: `GenesisWorkspaceDescriptor | null`
- `navigationItems`: `GenesisNavigationItem[]`
- `capabilities`:
  - `enabledModuleIds: string[]`
  - `featureFlags: string[]`
- `state`:
  - `initialized: boolean`
  - `workspaceResolved: boolean`
  - `navigationResolved: boolean`
  - `issueCode?: "NO_AUTHORIZED_WORKSPACE" | "NO_WORKSPACE"`

## Supporting Functions
- `loadWorkspace(context)`
- `resolveNavigation(context, workspace)`
- `resolveCapabilities(workspace)`
- `getBootstrapState({ workspace, navigationItems })`

## Behavioral Guarantees
- If no authorized workspace exists, bootstrap returns:
  - `workspace: null`
  - `navigationItems: []`
  - `state.initialized: false`
  - `state.issueCode: "NO_AUTHORIZED_WORKSPACE"`
- If workspace exists, bootstrap returns initialized state with resolved navigation and capabilities.

## Layering Rule
- Application routes must consume this public API for platform bootstrap concerns.
- Direct route-level coordination with runtime/workspace implementation modules is disallowed by policy direction.

## Non-Goals
- Does not redefine runtime authority ownership.
- Does not expose persistence access semantics.
