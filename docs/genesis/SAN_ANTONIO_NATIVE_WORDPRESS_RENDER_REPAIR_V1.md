# San Antonio Native WordPress Render Repair V1

## Locked Identity

- WordPress object: `13103`
- Status: `draft`
- Artifact SHA-256: `0255fda847e2962dc0ae10afcd86a646a5d89aef303331286babf2dae49078d2`
- Approved composition commit: `69481665113d9a39dc206075e9496ff262b59e67`
- Product authority media: `10757`
- Generated contextual media: `13100`, `13101`, `13102`

## Native Root Cause

Authenticated WordPress REST readback before repair established:

- Template: `elementor_header_footer`
- Operative body authority: `POST_CONTENT`
- Elementor document present: false
- Featured media: `10757`
- Genesis hero inside post content: true
- Genesis primary-presentation ownership declaration: false

The owner-observed native preview showed Cerato's `.page-title.the-title` and `.post-media.single-image` wrappers before the Genesis hero. Those wrappers are theme pre-content hooks, not part of the stored composition. Template metadata alone did not suppress them in this native preview path.

Cerato also contributes broad inherited wrapping behavior. The rich-composition grids lacked an explicit native-shell min-content contract for every grid child. The combination allowed the copy tracks to contract and large headings to hyphenate or fragment even though the stored grid declaration was 55/45.

## Repair

Receipt: `san-antonio-native-repair-acb7afbf-defe-46a9-b582-b61e42459813`

- Before POST_CONTENT hash: `a61f1268c93b269f82fbd6904f437c1b90429cc11efef8f30428842de3caca31`
- After POST_CONTENT hash: `98310d967361e3db57c18a782cbe2340e46552f73a9624a8f182b4c6055b2128`
- Contract: `GENESIS_OWNS_PRIMARY_PAGE_PRESENTATION_V1`
- Page-scoped suppression: `body.page-id-13103 .page-title.the-title` and `body.page-id-13103 .post-media.single-image`
- Featured-media assignment retained: `10757`
- Product grid: `minmax(0,1.1fr) minmax(22rem,.9fr)`
- Tablet/mobile grid: `minmax(0,1fr)`
- Grid children and copy columns: `min-width:0`
- Rich-composition headings: normal word breaking, no automatic hyphenation
- Long links remain safely breakable only in bounded mobile prose/link surfaces

No global theme CSS, header, footer, breadcrumb, published page, content artifact, media asset, target, job, or execution was changed.

## Deterministic Compatibility Certification

Certification: `san-antonio-native-render-certification-v1_1-san-antonio-native-repair-acb7afbf-defe-46a9-b582-b61e42459813`

The signed evidence route uses the live SSI header/footer shell, retains a standard breadcrumb, injects authenticated WordPress `content.rendered`, and deliberately includes Cerato's duplicate title and featured-image wrappers so their suppression is measured.

| Viewport | Product tracks | Media share | Copy width | Image ratio | Max fragments per heading word | Overflow |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1440 | 792 / 648 px | 55% | 648 px | 2.22228 | 1 | 0 |
| 1024 | 563 / 461 px | 55% | 461 px | 2.22233 | 1 | 0 |
| 768 | stacked | 100% | 768 px | 2.22226 | 1 | 0 |
| 375 | stacked | 100% | 375 px | 2.22222 | 1 | 0 |

At every viewport: one visible H1, four semantic media roles, global header/footer present, duplicate theme title hidden, duplicate standalone featured image hidden, normal heading word-breaking, no automatic heading hyphenation, and no horizontal overflow.

## Native Preview Boundary

Genesis cannot access the owner's authenticated WordPress preview session and does not store or bypass it. Therefore:

- Deterministic shell compatibility: PASS
- Native preview automation available: false
- Native WordPress preview certification claimed: false
- Owner native preview review: required

The owner must open WordPress object `13103`, click Preview, and visually confirm the repaired native render before any separate publication authorization.