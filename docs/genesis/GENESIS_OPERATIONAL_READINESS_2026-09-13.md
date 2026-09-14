# Genesis Operational Readiness - 2026-09-13

## Executive summary

Genesis is ready to operate its already-certified public references and the Commercial Stainless site, but it is not ready for unattended campaign execution from the current mutable runtime.

- `READY_NOW`: Commercial Stainless public site, ProjectorEnclosure Dallas and Houston public references, WordPress authority for the three current production sites, scheduler target integrity, and the read-only operator surfaces.
- `READY_WITH_OWNER_ACTION`: ProjectorEnclosure Texas as a governed campaign. Dallas and Houston are certified; Austin is reference-complete; San Antonio remains deliberately queued and requires fresh owner authorization before any work.
- `BLOCKED`: new automated GLW execution. The current runtime has no configured n8n MCP connector, current HEAD has no matching enabled release capability, six historical page-execution records remain nonterminal, and one current SSI benchmark target is failed.
- `INACTIVE`: the disabled Secondary Test Site and the draft Outdoor LED Sphere Overview campaign.

No publication, campaign dispatch, workflow execution, San Antonio action, content mutation, or port 3001/3002 change was performed during this audit.

## Audit boundary

| Item | Observed state |
|---|---|
| Worktree | `feature/genesis-operator-ui-v1` at `b601742985d0fc863f74b2eabe8b3525ec76d355` |
| Upstream | Exact match, divergence `0/0` |
| Certified tag | Annotated tag object `578cf950...`; certified commit `dae8b1c3d4dcbb451a4801aa26536b5b02a28c6e` |
| Working tree before documentation | Clean |
| Evidence | Durable JSON CAS state, read-only APIs, direct public HTTPS/WordPress GETs, browser checks, and process identity |
| Prohibited actions | All remained prohibited and were not attempted |

Readiness terms:

- `READY_NOW`: safe for its stated, already-authorized operational purpose.
- `READY_WITH_OWNER_ACTION`: technical prerequisites exist, but an explicit review or authorization is required.
- `BLOCKED`: a technical or governance condition prevents the stated operation.
- `INACTIVE`: intentionally disabled, draft-only with no current operation, or outside the active registered fleet.

## Runtime matrix

| Runtime | Identity | State | Classification | Operational use |
|---|---|---|---|---|
| `3001` | Immutable Next production release under `C:\ProgramData\Genesis\GLW\releases\03860b9b...`; HTTP 200 | Preserved | `READY_NOW` | Certified production surface. Do not modify for tomorrow's work. |
| `3002` | `glw-bounded-research-batch-v1`, Next dev plus foundation sidecar; HTTP 200 | Preserved | `READY_NOW` | Existing bounded support runtime. Keep isolated from this worktree. |
| `3003` | Current worktree, Next dev, shared secure environment; HTTP 200 | Mutable operator runtime | `READY_NOW` for read/review; `BLOCKED` for dispatch | Use for review, public verification, and owner decisions. Do not dispatch until connector and release blockers are cleared. |

## Registered site matrix

| Site | Durable state | Public/authority evidence | Classification | Next action |
|---|---|---|---|---|
| Commercial Stainless Counters (`rj-metal`) | Production, active, enabled, healthy, publishing `ready`, onboarding `connected`, policy `publish_after_gates` | Verified plan is `VERIFIED`; 21/21 operations succeeded; 15/15 pages published; media 15/15; SEO mismatches 0; latest responsive visual certification `PASS` and approved. Independent probe: all 15 pages HTTP 200, self-canonical, one H1, image present, quote path present. | `READY_NOW` | Monitor only. No republish is needed. The older unused `READY_FOR_EXECUTION` plan should be archived/reconciled separately. |
| ProjectorEnclosure.com (`ssi`) | Production, active, enabled, healthy, publishing `ready`; credential and all profile references present | Home HTTP 200. Dallas and Houston HTTP 200, exact self-canonicals, expected H1s, media and links present. Durable Dallas/Houston reference certifications exist. | `READY_NOW` for certified public pages; `READY_WITH_OWNER_ACTION` for Texas expansion | Keep Dallas/Houston unchanged. Review Austin evidence. Obtain fresh owner authorization before San Antonio. |
| SSI Displays (`ssi`) | Production, active, enabled, healthy, publishing `ready`; credential and all profile references present | Home HTTP 200 and self-canonical. Campaign drafts exist, but one current target is failed and two legacy SSI execution records are nonterminal. | `BLOCKED` for automated campaign operation | Reconcile stale executions and failed Tennessee target; complete owner draft reviews. |
| LEDDisplayWarehouse.com (`led-display-warehouse`) | Production, active, enabled, health `degraded`, publishing `not_ready`; no last connection/publish evidence | Two active legacy campaigns and four stale nonterminal execution records remain in durable state. | `BLOCKED` | Owner must decide whether to restore/onboard this site or retire its campaigns and reconcile stale records. Do not dispatch. |
| Secondary Test Site (`led-display-warehouse`) | Test, draft, disabled, not configured, publishing disabled | No operational authority | `INACTIVE` | Leave disabled or explicitly remove through a separately approved cleanup. |

The SSI site records still show onboarding `not_started` and no generic last-connection timestamps even though current WordPress credentials/profiles and bounded publication evidence work. Treat this as registry metadata debt, not permission to retest or publish.

## Campaign matrix

Durable campaign inventory contains eight campaigns and 101 targets. The scoped SSI API exposes the five SSI campaigns; the remaining three are legacy LED Display Warehouse records.

| Campaign | Target state | Classification | Blocker or owner action |
|---|---|---|---|
| ProjectorEnclosure Texas Cities | 4: 1 reference-complete, 2 published, 1 queued | `READY_WITH_OWNER_ACTION` | Dallas `#13084` and Houston `#13093` are certified. Austin has no WordPress object. San Antonio has no lease, job, object, or public page and requires new owner authorization. MCP/release remain blocked. |
| ProjectorEnclosure California Starter Cities | 2: 1 reference-complete, 1 draft-ready | `READY_WITH_OWNER_ACTION` | Owner draft review. Do not publish or dispatch. |
| ProjectorEnclosure California Expanded Cities | 10: 1 reference-complete, 9 draft-ready | `READY_WITH_OWNER_ACTION` | Owner draft review. Product wiring and media are shown as partial in the operator UI. |
| SSI Accent Texas Cities | 15: 1 reference-complete, 8 draft-ready, 1 published, 5 skipped | `BLOCKED` for automation; reviews available | Five recovered objects failed current readiness gates and are safely skipped. Reconcile stale Austin `RUNNING` and San Antonio `DISPATCHED` execution records before new automation. |
| SSI Accent Multi-State Benchmark | 10: 1 reference-complete, 8 draft-ready, 1 failed | `BLOCKED` | Tennessee failed with `Generation failed.` Owner/platform decision required: reconcile or approve a bounded retry after platform blockers are cleared. |
| Indoor LED Sphere 50 States | 50: 49 published, 1 reference-complete | `BLOCKED` | Owning site is degraded/not-ready and not part of the current three-site production-ready set; two stale nonterminal jobs are associated with this product family. |
| Indoor Digital Sphere California Cities | 10: 9 published, 1 reference-complete | `BLOCKED` | Same legacy site authority issue; historical output does not create current execution authority. |
| Outdoor LED Sphere Overview | Draft campaign, 0 targets | `INACTIVE` | Leave draft until the owning site is explicitly restored. |

Campaign configuration-level completed/failed counters are not authoritative. The matrix above uses durable target records.

## Texas reference detail

| Target | Durable state | Public state | Classification |
|---|---|---|---|
| Austin | `reference_complete`; no job, lease, or WordPress object | No publication authority asserted | `READY_WITH_OWNER_ACTION` |
| Dallas | `published`; job `2ca74016...`; WordPress `#13084` | HTTP 200; exact canonical; H1 `Protected projection, planned for North Texas.`; certified reference evidence | `READY_NOW` |
| Houston | `published`; no scheduler job; WordPress `#13093` | HTTP 200; exact canonical; semantic H1 verified; four media roles; PUBLIC_RENDER visual certification and reference certification | `READY_NOW` |
| San Antonio | `queued`; no job, lease, or WordPress object | Public route HTTP 404; WordPress slug query returned `[]` | `READY_WITH_OWNER_ACTION` |

The historical dispatch date on San Antonio is metadata only. It does not represent a current lease, job, external execution, WordPress identity, or authorization.

## Execution and connector readiness

### Durable execution health

- 121 page-execution records: 105 `COMPLETE`, 10 `FAILED`, 3 `RUNNING`, 2 `CONTENT_READY`, and 1 `DISPATCHED`.
- Six nonterminal records are stale, dated 2026-08-31 through 2026-09-05.
- Current SSI stale records:
  - Accent Austin: `RUNNING`, `POLL_TIMEOUT`, external execution `320913`.
  - Accent San Antonio: `DISPATCHED`, external execution `427973`.
- Legacy LED Display Warehouse stale records: California `RUNNING`, Alaska `RUNNING` and `CONTENT_READY`, Delaware `CONTENT_READY`.
- No active target leases, duplicate target IDs, duplicate target WordPress bindings, duplicate job IDs, or duplicate external execution IDs were found.
- The generic `/api/executions` view returns no active execution objects for `ssi` or `rj-metal`; the stale records live in the GLW page-execution store and require explicit reconciliation.

### Connector matrix

| Capability | Evidence | Classification |
|---|---|---|
| n8n MCP transport | Runtime/shared environment reports not configured; no `GLW_N8N_MCP_URL` plus token pair. Required tools are `execute_workflow` and `get_workflow_execution`. No workflow call was made. | `BLOCKED` |
| Release authority | Enabled capability records exist through certified commit `dae8b1c3...`; current HEAD is `b6017429...`. Operator UI reports `Release BLOCKED`. | `BLOCKED` |
| Scheduler integrity | Zero leases and duplicate identities. Draft-only contract, exact target ownership, bounded retry, and no-callback MCP validation are present. | `READY_NOW` for safety; `BLOCKED` for dispatch |
| WordPress authority | All three current production sites have credential references and API bases; Commercial Stainless has a verified connection; public read checks pass. | `READY_NOW` for authorized bounded work |
| Research | Dallas/Houston governed evidence and market-opportunity surfaces are usable. General source registry contains only one durable source. | `READY_WITH_OWNER_ACTION` for new markets |
| Content generation | Existing SSI and ProjectorEnclosure drafts are available for review. One current target failed; historical nonterminal records remain. | `READY_WITH_OWNER_ACTION` for review; `BLOCKED` for new execution |
| Media | Certified Dallas/Houston and Commercial Stainless public media pass. Campaign UI reports partial images/product wiring for unreviewed campaigns. | `READY_WITH_OWNER_ACTION` |
| Composition/theme | Dallas and Houston reference paths and Commercial Stainless responsive composition are certified. | `READY_NOW` for those exact artifacts |
| Publication | Commercial Stainless and exact Dallas/Houston objects are verified. No generalized current-release dispatch authority exists. | `READY_NOW` for monitoring; `BLOCKED` for new automated publication |

## Operator UI

Overall classification: `USABLE_WITH_GAPS`.

Verified at port 3003:

- Campaign list, Page Studio, Dallas market opportunities, Houston certified reference, and site registry all returned HTTP 200.
- Tested routes had zero horizontal overflow and zero broken images.
- Campaign cards expose target progress, blockers, next action, release/MCP/scheduler/WordPress status, media state, and owner-review paths.
- Houston exposes publication, SEO, H1, visual, drift, receipt, and certification evidence.

Gaps:

- Global navigation remains labeled `LED Display Warehouse` across organizations.
- Page Studio resolves an LED Display Warehouse workspace under an SSI query.
- Organization/site shell selection can retain legacy context while scoped page content shows SSI or RJ Metal.
- The site registry route does not apply the query organization as its table filter by default.
- One browser request returned HTTP 400 while loading the site registry; the page remained usable.
- Generic site onboarding timestamps for SSI do not reflect proven bounded WordPress operations.

These gaps are operator-context risks, not publication failures. An operator must verify the visible organization, site, campaign ID, and target before any future mutation.

## Blocker register

| Severity | Blocker | Scope | Required resolution | Owner |
|---|---|---|---|---|
| P1 | MCP connector not configured | All new GLW execution | Configure endpoint/token in the approved runtime secret source, restart only port 3003, and run list-tools preflight. Do not execute a workflow during preflight. | Platform owner |
| P1 | Current HEAD lacks enabled release capability | All new GLW execution | Certify the exact intended release SHA or run from an already-certified immutable release. Preserve port 3001. | Release owner |
| P1 | Six stale nonterminal page executions | SSI Displays and legacy LED campaigns | Read authoritative n8n outcomes, then explicitly reconcile each record. Do not redispatch until identities and outcomes are resolved. | Platform operator |
| P1 | SSI benchmark Tennessee target failed | SSI multi-state campaign | Inspect failure evidence and choose reconcile, abandon, or bounded retry after connector/release readiness. | Campaign owner |
| P1 | LED Display Warehouse degraded/not-ready | Three legacy campaigns | Restore site authority and connection health or retire the campaigns. | Site owner |
| P2 | Five SSI Texas recovered objects are skipped | SSI Accent Texas | Review object identity/readiness evidence; retain duplicate-generation block until resolved. | Campaign owner |
| P2 | Operator context can disagree with scoped content | Cross-organization UI | Fix context propagation and navigation naming before delegating mutating operation to a less experienced operator. | Product/code owner |
| P2 | Stale unused Commercial Stainless execution plan | Commercial Stainless | Archive/reconcile the older 0/21 `READY_FOR_EXECUTION` plan; retain the verified 21/21 plan as authority. | Platform operator |
| P3 | SSI onboarding metadata is stale | SSI sites | Reconcile metadata from existing proven connection evidence in a separate, audited change. | Site owner |

## Tomorrow's safe operating sequence

1. Keep ports 3001 and 3002 unchanged. Use port 3003 for read/review only.
2. Review this blocker register before opening any campaign control.
3. Configure and validate MCP with `listTools` only. Required tools: `execute_workflow`, `get_workflow_execution`.
4. Establish release capability for the exact runtime SHA intended for execution.
5. Read and reconcile the six stale n8n/page-execution identities. Do not redispatch them.
6. Resolve or explicitly defer the SSI Tennessee failure and the five skipped recovered targets.
7. Conduct owner draft review for the two ProjectorEnclosure California campaigns and remaining SSI drafts.
8. Review Austin as the next Texas evidence candidate.
9. Request a separate explicit owner authorization for San Antonio only after steps 3-8 pass. A dispatch date or queued status is not authorization.
10. Continue read-only monitoring of Commercial Stainless, Dallas, and Houston; no republish is indicated.

## Owner decision queue

| Decision | Options | Default safe state |
|---|---|---|
| San Antonio | Authorize a fresh governed draft attempt, request more evidence, or defer | Defer; remain queued with no job/object |
| Austin | Promote from reference-complete into a separately approved draft workflow, or retain as reference | Retain reference-complete |
| California drafts | Approve, request revision, or defer each draft | Defer publication; review only |
| SSI Tennessee failure | Reconcile, abandon, or authorize bounded retry | No retry |
| LED Display Warehouse | Restore active authority or retire/deactivate legacy campaigns | No execution |
| Stale executions | Reconcile from authoritative n8n outcomes or close as historical failures | No redispatch |

## Deferred improvements

- Make URL scope authoritative in the global workspace shell and Page Studio.
- Add an explicit stale-execution dashboard and reconciliation workflow.
- Separate campaign configuration counters from durable target counters in APIs and documentation.
- Surface release capability SHA and MCP tool-preflight evidence directly in operator cards.
- Reconcile generic onboarding/connection timestamps from governed site evidence.
- Archive superseded site-publication plans without deleting their audit history.
- Expand the general research-source registry before launching a new market not covered by a bespoke governed evidence bundle.

## Automated execution recovery V1

Recovery was performed after the original audit without dispatching a target or executing a workflow. The executable recovery commit is `3c19b4b8bc7c4e61116979c9b80f15182ca70d0e`; port 3003 runs with that exact `GIT_COMMIT`. Documentation may advance repository HEAD without changing the executable identity.

### MCP and n8n recovery

- Original state: `UNCONFIGURED` because port 3003 loaded the bounded shared-persistence environment only. Next environment loading is project-root cached and did not merge the approved onboarding environment.
- Configuration authority: `glw-site-onboarding/.env.local` contains the existing governed `GLW_N8N_MCP_URL` and `GLW_N8N_MCP_TOKEN`; no secret was copied to source control or printed. Shared persistence remains under the bounded environment.
- Runtime repair: port 3003 was restarted only, with MCP values read from the approved onboarding environment, bounded shared state retained, and exact executable SHA set.
- MCP session establishment and tool discovery passed. `execute_workflow` and `get_workflow_execution` are both available.
- Recovery workflow `9WTjTDXX0QNgF6Mw` and engine workflow `bIDXxyWnY22G8zJC` are visible and active.
- Timeout remains the adapter's bounded default of 15 seconds. Execution reads use bounded retry. The scheduler serializes one target per campaign invocation; MCP clients are bounded per operation and reconnect on a subsequent operation.
- No `execute_workflow` call was made. Historical lookups used `get_workflow_execution` with execution data omitted.

Final state: MCP `READY`; n8n `READY`.

### Release authority recovery

- Original port 3003 identity: absent `GIT_COMMIT`, so exact release capability resolved `MISSING` regardless of repository HEAD.
- Prior ProjectorEnclosure authority ended at certified source `dae8b1c3d4dcbb451a4801aa26536b5b02a28c6e`; SSI Displays had no scoped capability.
- No deployed artifact existed for the certified source or the readiness-documentation HEAD. Port 3001 remains the unrelated immutable production release `03860b9b5d03f20aebf13519e95719ed2fe9bd77`.
- Existing architecture defines release authority as an `ORGANIZATION_SITE` capability for exact `GIT_COMMIT` and operation `GLW_CAMPAIGN_ACTIVATION`. Capability enablement explicitly creates no owner grant, activation, dispatch, or publication authority.
- Exact capabilities were enabled for executable SHA `3c19b4b8bc7c4e61116979c9b80f15182ca70d0e` on `site-ssi-projectorenclosure` and `site-ssi-screen-solutions-international` by the existing platform-admin endpoint.
- The scheduler now verifies exact scoped release capability and WordPress authority before MCP preflight and before any lease. Its GET returns the same evidence as a non-mutating dry preflight.

Final state: release authority `READY` for the two current SSI production sites on port 3003. A per-action owner confirmation remains required before dispatch.

### Stale execution dispositions

The original count of six combined four active-state orphans with two `CONTENT_READY` records. `CONTENT_READY` is terminal under the execution service and was preserved.

| Job / external execution | Scope and target | Prior state | Authoritative evidence | Disposition |
|---|---|---|---|---|
| `4b03d3f0-3e7b-488f-999d-f8e928724d08` / `320913` | SSI Displays; Accent Texas Austin; no current target binding | `RUNNING`, `POLL_TIMEOUT`, last activity 2026-08-31 | n8n no longer retains ID; no target job binding; no lease; no WordPress object | `ORPHANED`, reconciled terminal `FAILED`; receipt `orphan-reconciliation-4b03d3f0-3e7b-488f-999d-f8e928724d08` |
| `783c3281-f46b-43d7-bc42-3a414ec4c686` / `338978` | Legacy LED Display Warehouse; California; no current target binding | `RUNNING`, `POLL_TIMEOUT`, last activity 2026-08-31 | n8n ID not retained; no binding/lease/object | `ORPHANED`, reconciled terminal `FAILED`; receipt `orphan-reconciliation-783c3281-f46b-43d7-bc42-3a414ec4c686` |
| `b67d762e-57fa-4ad5-a998-52d22b2a7258` / `376492` | Legacy LED Display Warehouse; Alaska; no current target binding | `RUNNING`, `POLL_TIMEOUT`, last activity 2026-09-02 | n8n ID not retained; no binding/lease/object | `ORPHANED`, reconciled terminal `FAILED`; receipt `orphan-reconciliation-b67d762e-57fa-4ad5-a998-52d22b2a7258` |
| `44e467c5-e927-45eb-9c75-887a7d09709e` / `377402` | Legacy LED Display Warehouse; Alaska; no current target binding | `CONTENT_READY`, last activity 2026-09-02 | Generated content is durably present; execution service treats `CONTENT_READY` as terminal | `COMPLETED_BUT_UNRECONCILED`; preserved, not runnable |
| `0ce549f3-13fa-44e3-803d-59495a53a24e` / `381416` | Legacy LED Display Warehouse; Delaware; no current target binding | `CONTENT_READY`, WordPress identity `19845`, last activity 2026-09-02 | Content/identity evidence is durable; execution service treats `CONTENT_READY` as terminal | `COMPLETED_BUT_UNRECONCILED`; preserved, not runnable |
| `0a25f6d8-186d-4086-b4ce-d3518aab7b8a` / `427973` | SSI Displays; Accent Texas San Antonio; no current target binding | `DISPATCHED`, last activity 2026-09-05 | n8n ID not retained; no binding/lease/object | `ORPHANED`, reconciled terminal `FAILED`; receipt `orphan-reconciliation-0a25f6d8-186d-4086-b4ce-d3518aab7b8a` |

After recovery: active-state stale executions `0`; active leases `0`; dangling leases `0`; active orphan jobs `0`; stuck executions `0`. The two detached content-ready artifacts remain historical evidence and cannot consume concurrency.

### SSI benchmark failure

The exact target is `target-campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-multi-state-benchmark-tn`, job `9fa54ac3-36fe-48ce-b0f8-25e3e7e798c6`.

- Target state: terminal `failed`, one attempt, no lease, no WordPress object.
- Execution state: terminal `FAILED`, `DISPATCH_FAILED`, no external execution ID, no generated content, no publication state.
- Failure stage: MCP transport dispatch failed on an upstream 502 before an external execution was created.
- Classification: `BENCHMARK_ONLY_FAILURE` and valid historical terminal failure.
- Disposition: preserve as failed evidence. Do not retry or convert to pass. It blocks that campaign target, not other campaigns or global scheduler concurrency.

### Final dry execution preflight

Subject: ProjectorEnclosure Texas / San Antonio, inspected only through scheduler GET.

| Gate | Result |
|---|---|
| Target identity | `READY`: exact queued San Antonio target |
| Campaign eligibility | `READY`: campaign active |
| Release authority | `READY`: exact executable SHA and scoped capability |
| WordPress credentials | `READY`: API and credential references configured |
| MCP | `READY`: configured and connected |
| n8n | `READY`: required tools and both workflows visible |
| Concurrency | `READY`: 0 running, 1 slot available |
| Daily allowance | `READY`: 0 used, 10 remaining for 2026-09-13 |
| Publication policy | `READY`: `draft_only` |
| Owner authorization | `REQUIRED`: exact dispatch confirmation remains absent |

No POST was sent. San Antonio remains queued with no lease, job, execution, or WordPress object. The point at which dispatch becomes possible is the separate owner-authorized exact-target scheduler POST after rechecking this preflight.

### Operator context safety

Classification: `DISPLAY_ONLY`.

The shell and Page Studio can display stale LED Display Warehouse labels under another query scope, but mutating campaign APIs resolve request organization/site authority and require the campaign to match that scope. Scheduler downstream requests use the persisted campaign organization/site, not the visible shell selection. No cross-organization action-authority path was found, so no UI repair was made in this bounded recovery.

### Recovery readiness matrix

| Area | Final state | Basis |
|---|---|---|
| MCP | `READY` | Configured, connected, required tools discovered |
| n8n | `READY` | Recovery and engine workflows visible/active; read-only lookups operational |
| Release authority | `READY` | Exact executable SHA authorized for both SSI production sites |
| Execution state | `READY` | No active stale executions; four orphan receipts; content-ready evidence preserved |
| Scheduler | `READY` | Zero leases, exact-release/MCP/WordPress gates before lease, concurrency 1, deterministic target and daily allowance |
| Operator action context | `READY` | Display-only mismatch; action APIs enforce exact organization/site/campaign scope |

Overall: `AUTOMATED_EXECUTION_READY_WITH_OWNER_ACTION`.

Tomorrow:

- `READ_ONLY_OPERATIONS`: monitor Commercial Stainless, Dallas, Houston, campaigns, executions, public health, and dry preflight.
- `MANUAL_GOVERNED_OPERATIONS`: review existing drafts and evidence; reconcile historical content-ready artifacts only under a separate exact decision.
- `AUTOMATED_EXECUTION`: technically ready but stopped at explicit owner authorization. The first owner action is an exact authorization for the intended target; if San Antonio is selected, authorize San Antonio specifically. The operator must rerun dry preflight immediately before POST.

## Final determination

The platform is operational for monitoring and maintaining already-certified public output. Commercial Stainless, Dallas, and Houston remain `READY_NOW`. The four technical execution blockers are resolved or correctly terminalized. Automated execution is `READY_WITH_OWNER_ACTION`: an exact owner-authorized target confirmation is still required, and San Antonio remains intentionally stopped.
