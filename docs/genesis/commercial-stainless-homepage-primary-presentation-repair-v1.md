# Commercial Stainless Homepage Primary Presentation Repair V1

## Owner evidence

The owner-provided native public evidence is accepted. Before repair, the actual homepage rendered the Twenty Twenty-Five `core/post-title` heading “Home” between the global header and the Genesis hero. Actual-host inspection confirmed two visible H1 elements.

## Immutable homepage authority

Authenticated WordPress authority before the host snippet update:

- WordPress object: 10
- Status: `publish`
- Current revision: 85
- Stored raw-content SHA-256: `a6bbe8f0db6080c2732cb4baec7bba5d361ebacfc40a16815c655cef8f0e4508`
- Featured media: 41
- SEO title: `Commercial Stainless Counters & Custom Stainless Fabrication`
- SEO description: `Commercial Stainless Counters connects commercial buyers with counters, countertops, worktables, workstations, and custom stainless fabrication pathways.`
- Robots: `index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1`
- Canonical: `https://commercialstainlesscounters.com/`

The authenticated post-repair read returned the same object, status, revision, raw-content hash, featured media, SEO identity, robots policy, and canonical. No page-content, media, navigation, SEO, canonical, or featured-media write was performed.

## Root cause and bounded eligibility

The primary-presentation filter used `is_page()`. WordPress returns false for the configured static front page even though the queried object is a published page. The homepage was therefore excluded before composition markers were inspected.

The actual immutable homepage content uses `gvc-page` and `gvc-hero`. It does not use the later interior-page `wr-page` and `wr-hero` marker family. Requiring literal `wr-*` markers would require an unauthorized composition rewrite.

`GENESIS_RICH_PAGE_OWNS_PRIMARY_PAGE_PRESENTATION` now accepts exactly:

- `commercialstainlesscounters.com`
- published WordPress page
- page or static-front-page request context
- interior content with `wr-page` and `wr-hero`; or
- configured static front-page content with `gvc-page` and `gvc-hero`

The `gvc-*` branch cannot qualify an ordinary interior page. Design-Build remains outside the contract.

The first parameterized snippet deployment exposed a PHP closure-capture defect and temporarily failed all marker checks. Actual-host validation caught it before certification. The recursive closure was corrected to capture `$page_class` and `$hero_class`, snippet 6 was redeployed, and all homepage/interior controls were rerun successfully.

## Actual public host certification

Public URL: `https://commercialstainlesscounters.com/`

Authority: `ACTUAL_PUBLIC_HOST_RENDER`

After the corrected snippet deployment:

- HTTP 200: true
- Global header count: 1
- Theme “Home” title visible: 0
- Genesis hero visible: 1
- Semantic H1 count: 1
- Duplicate primary heading count: 0
- Global footer count: 1
- Header-to-hero gap: 0px
- Header overlap: 0px

Responsive browser evidence:

| Viewport | Result | Horizontal overflow | Header/hero gap | Header overlap | Hero clipped |
|---:|---|---:|---:|---:|---|
| 1440 | PASS | 0 | 0 | 0 | false |
| 1024 | PASS | 0 | 0 | 0 | false |
| 768 | PASS | 0 | 0 | 0 | false |
| 375 | PASS | 0 | 0 | 0 | false |

Desktop and mobile screenshots confirmed that the first substantial content directly below the global header is the Genesis rich hero.

## Regression and preservation

Actual-host checks returned title count 0 and H1 count 1 for objects 12, 15, 16, 18, and 19. Page 15 retained approved hash `ac370c9f08aff1b496e16346078d0959ab92d29a4e6a36f57e0dbb54a9bac36c` at revision 115.

Design-Build remained non-rich, retained its ordinary title behavior, and was not mutated. Production runtime 3001, homepage authority, Wave 1, Wave 2 content, Wave 3, Agent 1, ProjectorEnclosure, and the certified tag were not mutated by this host-presentation repair.
