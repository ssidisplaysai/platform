# Dallas Public Theme Integration Repair V1

## Scope

This repair applies only to WordPress page `13084`. Dallas remains a draft. No publication, campaign reconciliation, generation, media generation, or dispatch is authorized.

## Root causes

- Duplicate H1: Cerato's default page template emitted `.page .main-content > .container > .page-title.the-title` before the approved Genesis body. The same wrapper emitted `.post-media.single-image`, duplicating featured media `10757` outside the approved composition.
- 1024 overflow: the failed public default-template shell measured 107 pixels of horizontal overflow. The default shell and its fixed-width title/media container were replaced page-locally. During equivalent-render development, a second apparent header overflow was traced to blocked Barlow Condensed font assets; allowing only the shell's declared Google Fonts origins restored the authoritative header geometry.

## Repair authority

The WordPress page template changed from `default` to the existing `elementor_header_footer` template used by published ProjectorEnclosure pages. Registered page metadata `_elementor_page_settings.hide_title` is set to `yes`.

The repair does not change `post_content`, SEO, parent, canonical path, featured media, semantic media assignments, links, local context, theme profile, composition, or market strategy. No global theme CSS or template was changed.

## Theme-integrated draft evidence

WordPress Application Passwords authenticate REST requests but do not authenticate front-end draft previews; the direct preview returned a themed 404. Genesis therefore uses a bounded signed equivalent:

- fixed source shell: published WordPress page `10541`, which uses `elementor_header_footer`;
- real ProjectorEnclosure header, footer, styles, fonts, and same-origin scripts;
- exact authenticated Dallas `content.rendered` inserted server-side;
- signed localhost-only route with fixed organization, site, job, page, and shell;
- no client credential exposure and no client-selectable target URL;
- closed legacy off-canvas overlays excluded from the non-interactive evidence document;
- immutable screenshots at 1440, 1024, 768, and 375 pixels.

## Reusable observability rule

`CONTENT_RENDER`, `THEME_INTEGRATED_RENDER`, and `PUBLIC_RENDER` are distinct evidence classes. A content-render pass does not imply theme integration or public readiness.

For WordPress-backed pages, `THEME_INTEGRATION_READY` requires available evidence for:

- exactly one visible H1, owned by approved content;
- no visible duplicate theme title;
- no visible duplicate theme featured media;
- zero horizontal overflow at required viewports;
- visible global header and footer;
- all required semantic media roles;
- approved-body drift of `NONE` or `MINOR`.

Dallas now passes this prepublication gate and waits for owner review. It was not republished.