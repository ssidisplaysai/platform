# GBA-0004 Marketing Agent v1.0

## Purpose
GBA-0004 is the Genesis Marketing Agent orchestration layer. It consumes the certified Marketing Kernel Platform exactly as the Manufacturing Agent consumes the Operations Agent: by treating the kernel as the source of truth for execution concerns and layering planning, synthesis, review, and reporting above it.

## Scope
1. Campaign planning and campaign lineage.
2. Content strategy synthesis.
3. SEO intelligence review.
4. Brand governance review.
5. Analytics snapshot synthesis.
6. Recommendation review and triage.
7. Timeline and executive reporting.
8. Protected workspace access and API surface.

## Non-Scope
1. Content publishing execution.
2. SEO execution or automation.
3. Campaign scheduling execution.
4. Kernel responsibility duplication.

## Architecture Position
The Marketing Agent reads from GMP kernel services and persists only slice-specific planning, review, and synthesis artifacts in additive GBA tables. It does not replace the kernel platform.
