# Commercial Stainless Page 15 Native Title Repair V1

## Owner evidence accepted

The authenticated WordPress editor screenshot is authoritative native owner evidence for object 15. It confirms the approved composition, hero, media, typography, contrast, and CTA, while also proving that the editor canvas still rendered the theme `core/post-title` band above the Genesis hero.

Publication authorization remains false. This repair did not invoke a WordPress page-content, autosave, revision-restore, or publication endpoint.

## Root cause

Object 15 differed from objects 12, 16, 18, and 19 when the screenshot was captured:

- its published parent contained legacy content
- approved hash `ac370c9f08aff1b496e16346078d0959ab92d29a4e6a36f57e0dbb54a9bac36c` resided in autosave 107
- the host predicate inspected only published/query post content
- `render_block` controlled frontend template rendering but could not hide the client-rendered title inside the block-editor canvas

The result was a false negative for `GENESIS_RICH_PAGE_OWNS_PRIMARY_PAGE_PRESENTATION` in the authenticated editor.

## Bounded repair

Snippet 6 now:

- accepts rich content only from the current page, its queried post, a revision whose `post_parent` is that page, or the current authenticated user's autosave whose `post_parent` is that page
- still requires the exact Commercial Stainless host, published page parent, `core/html`, `wr-page`, and `wr-hero` markers
- loads `.editor-styles-wrapper .wp-block-post-title{display:none!important}` through `enqueue_block_assets` only in the authenticated editor and only when the bounded rich predicate passes
- retains the existing frontend `core/post-title` render filter
- does not hide arbitrary headings or affect ordinary pages and Design-Build

Snippet 6 was updated in place and verified active, global, and byte-exact.

## Authority observation after repair

A post-repair live read found object 15 at current revision 115 with the approved hash in `post_content`; autosave 107 was no longer present. This transition occurred outside the snippet-only repair request, consistent with the authenticated editor screenshot showing `Published` and `Last edited a few seconds ago`. This task did not call the WordPress page-content endpoint and did not attempt an unauthorized rollback.

Current authority:

- `CurrentPublishedRevision=115`
- `CurrentPostContentHash=ac370c9f08aff1b496e16346078d0959ab92d29a4e6a36f57e0dbb54a9bac36c`
- `ApprovedHash=ac370c9f08aff1b496e16346078d0959ab92d29a4e6a36f57e0dbb54a9bac36c`
- `AuthorityLocation=APPROVED_AUTHORITY_IN_POST_CONTENT`
- `Object15ApprovedCompositionPreserved=True`

Native public structure after repair and the external authority transition:

- `ThemePageTitleVisible=0`
- `GenesisHeroVisible=1`
- `SemanticH1Count=1`
- `DuplicatePrimaryHeadingCount=0`
- `GlobalHeaderCount=1`
- `GlobalFooterCount=1`

## Fresh owner preview

Open the authenticated editor:

`https://commercialstainlesscounters.com/wp-admin/post.php?post=15&action=edit`

Reload the editor so the updated block-canvas stylesheet is applied. Do not select Save, Update, Publish, or Restore. Confirm that the canvas starts directly with the Genesis rich hero and contains no white theme-title band.

Until that fresh authenticated preview is visually confirmed:

- `OwnerReviewReady=False`
- `PublicationAuthorized=False`
