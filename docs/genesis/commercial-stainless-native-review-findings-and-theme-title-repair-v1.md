# Commercial Stainless Native Review Findings and Theme Title Repair V1

## Authorization boundary

Owner native WordPress findings are accepted as evidence. This task performed a staging-only Genesis durable-authority reconciliation and updated the existing WordPress host-render snippet. It did not invoke a WordPress page publication endpoint, reconstruct content, change copy or media, or publish object 15.

- Publication authorized: false
- Publication mutation: false
- WordPress page-content write by this task: false
- Code Snippets host-contract update: snippet 6, active, global, exact code
- Primary presentation contract: `GENESIS_RICH_PAGE_OWNS_PRIMARY_PAGE_PRESENTATION`

## Authority reconciliation

The approved raw content was read from the live proven authority and copied byte-for-byte into `commercial-stainless-wave2-durable-authority-v1`. A second live read proved current post and public hashes did not change during reconciliation.

| Object | Current published revision | Current post hash | Latest autosave revision | Latest autosave hash | Approved revision | Approved hash | WordPress authority location | Durable |
|---:|---:|---|---:|---|---:|---|---|---|
| 12 | 114 | `b2e2f2b690e3d518472bd56e08886701293314d2215838b37d7a3c7fdbf4ddc3` | none | none | 114 | `b2e2f2b690e3d518472bd56e08886701293314d2215838b37d7a3c7fdbf4ddc3` | `APPROVED_AUTHORITY_IN_POST_CONTENT` | true |
| 15 | 53 | `847de6153247b63b0d1246546c6f8b77c8369a1956f2d8a40febf957755b519d` | 107 | `ac370c9f08aff1b496e16346078d0959ab92d29a4e6a36f57e0dbb54a9bac36c` | 107 | `ac370c9f08aff1b496e16346078d0959ab92d29a4e6a36f57e0dbb54a9bac36c` | `APPROVED_AUTHORITY_IN_AUTOSAVE` | true |
| 16 | 111 | `ccac7e46d1c40239736c0c65ffe236bd4cbd62e3717cb7ddfd390cf395ef5f4f` | none | none | 111 | `ccac7e46d1c40239736c0c65ffe236bd4cbd62e3717cb7ddfd390cf395ef5f4f` | `APPROVED_AUTHORITY_IN_POST_CONTENT` | true |
| 18 | 112 | `ceb8b68be8125545a71e17f5a6a6ecdb0148f06180555ebaf1e0b389bb9076e2` | none | none | 112 | `ceb8b68be8125545a71e17f5a6a6ecdb0148f06180555ebaf1e0b389bb9076e2` | `APPROVED_AUTHORITY_IN_POST_CONTENT` | true |
| 19 | 113 | `5925c0b7c45d0b082f163c9286cb400e5ae47a35045f77cad8239f38d7206c46` | none | none | 113 | `5925c0b7c45d0b082f163c9286cb400e5ae47a35045f77cad8239f38d7206c46` | `APPROVED_AUTHORITY_IN_POST_CONTENT` | true |

Autosave dependency before reconciliation was one page: object 15. Autosave dependency after reconciliation is zero because exact raw content for all five pages is independently durable. Object 15 remains unpublished and its public legacy content is unchanged.

## Theme title ownership

The prior snippet source suppressed `core/post-title` using a broad page-ID list. The repaired filter now uses the same fail-closed rich-content predicate as featured-image and host-spacing suppression:

- host must be `commercialstainlesscounters.com`
- post type must be `page`
- status must be `publish`
- parsed content must contain both `wr-page` and `wr-hero` in a `core/html` block
- native previews inspect the queried preview post content, allowing an autosave preview to become eligible without changing the parent post

Only the `core/post-title` template block is suppressed. Genesis hero headings, arbitrary `core/heading` blocks, ordinary pages, and Design-Build remain untouched.

Native public checks after the repair:

| Object | Rich public content | Theme title visible | Genesis hero visible | H1 count | Duplicate primary heading |
|---:|---|---:|---:|---:|---:|
| 12 | true | 0 | 1 | 1 | 0 |
| 15 | false | ordinary public page retained | not applicable | ordinary page retained | not applicable |
| 16 | true | 0 | 1 | 1 | 0 |
| 18 | true | 0 | 1 | 1 | 0 |
| 19 | true | 0 | 1 | 1 | 0 |

Object 15 requires owner-authenticated native preview of autosave 107 to confirm the preview-only title band is removed. No actual-native claim is made for that post-repair autosave preview.

## Owner preview routes

Sign in to WordPress, open each editor, select the approved/current authority shown above, and use Preview in new tab. Do not select Update, Publish, or Restore.

- Object 12: `https://commercialstainlesscounters.com/wp-admin/post.php?post=12&action=edit`
- Object 15: `https://commercialstainlesscounters.com/wp-admin/post.php?post=15&action=edit` (select autosave 107)
- Object 16: `https://commercialstainlesscounters.com/wp-admin/post.php?post=16&action=edit`
- Object 18: `https://commercialstainlesscounters.com/wp-admin/post.php?post=18&action=edit`
- Object 19: `https://commercialstainlesscounters.com/wp-admin/post.php?post=19&action=edit`

Confirm that each eligible preview begins `GLOBAL SITE HEADER -> GENESIS RICH HERO -> GENESIS PAGE BODY -> GLOBAL SITE FOOTER`, with no intervening white title band.

## Design-Build follow-up

- `DesignBuildLegacyCompositionDetected=True`
- `DesignBuildWave2Mutation=False`
- `DesignBuildMutation=False`

Object 14 remains the narrow legacy composition and was not mutated. A later separately authorized task should stage it against the current wide rich-composition system, preserve its existing design-build authority and SEO identity, and obtain owner review before any publication.

## Preservation

Reconciliation second-read public hashes matched exactly:

- 12: `122915d866e233e95f606bd9e3599cf548c117e55ef1b9ca22c9b20179161c5b`
- 15: `686d7c8a5cbd27cc6dfc3ce33676bcb59b39ccc05c3f9232fc771cf11aa3f8e6`
- 16: `bca7b7ca67adcc4be0b86327bc69d2d7bab08a77f83d542fcb3c1cb69c45c809`
- 18: `485ca989f727387fb7bc90f49fb94c369f36d955a6cb6aa31cbfb0ccb321ac1a`
- 19: `6139fa8e43368dce425df26aa8a0b557f666969e47f62cdd2bf2f18e0b02d685`

Production runtime 3001, homepage, and all five Wave 1 public pages returned HTTP 200. Wave 3, Agent 1, ProjectorEnclosure, and the certified tag were not mutated.
