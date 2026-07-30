# GLW-0001 Architecture Discovery

## Scope
Pre-implementation discovery for restoring Genesis LED Warehouse (GLW) entry points in the clean baseline repository.

## Baseline
- Repository: `ssidisplaysai/platform`
- Branch: `feature/glw-entry-point-restoration-clean`
- Baseline SHA: `f2b220194b9d40b8722698dd5187fe03f747dc11`

## Findings

### 1. Next.js application serving the platform
- The active application is the root Next.js app in this repository.
- Runtime scripts are defined in `package.json` (`next dev`, `next build`, `next start`).
- App Router root is `src/app` with root layout at `src/app/layout.tsx`.

### 2. Authenticated/protected route model
- Protected shell behavior is implemented by `src/components/layout/app-shell.tsx`.
- Existing route pages wrap content with `<AppShell>...</AppShell>`.
- API authorization primitives are centralized in `src/modules/foundation/api-auth.ts`.

### 3. Application registration and navigation
- Navigation is descriptor-driven in `src/modules/foundation/navigation.ts` through `FOUNDATION_NAVIGATION_ITEMS`.
- Visibility is filtered by permissions in `src/modules/foundation/selectors.ts`.

### 4. Workspace context
- Workspace context is centralized in `src/modules/foundation/context.ts`.
- `createFoundationContext()` provides user, organization, and site context reused by shell and modules.

### 5. GLW existence and disconnect status
- No route segment exists for `src/app/glw`.
- No route file exists for `src/app/glw/page.tsx` or `src/app/glw/pages/page.tsx`.
- No GLW entry exists in `FOUNDATION_NAVIGATION_ITEMS`.

## Root Cause of 404
`/glw` and `/glw/pages` return 404 because no corresponding App Router files exist, and GLW is not registered in descriptor-driven navigation.

## Restoration Strategy
1. Create `src/app/glw/page.tsx` and `src/app/glw/pages/page.tsx` using existing `AppShell`.
2. Add GLW UI modules under `src/modules/glw` with honest empty states only.
3. Register GLW in `FOUNDATION_NAVIGATION_ITEMS` with `/glw` href.
4. Add focused tests for registration, visibility, route existence, and AppShell integration.
