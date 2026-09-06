# Integrator owner authority

## Source documents

- `XS - Integrator Projector Enclosure Overview & Specifications.pdf`
  - SHA-256: `56e60725e53b152474ed7deb1ee63babaf171229fde310ba35a557b976387c37`
  - Role: owner-supplied SSI first-party authority for Extra Small Integrator.
- `2025 Integrator Overview and Specifications (1).pdf`
  - SHA-256: `9f92b0b583415e9e3a98278dc597264802603555253ea265a8c0577bb78dc5f6`
  - Role: owner-supplied SSI first-party Integrator family, size, feature, and visual authority.

Owner confirmation establishes `Homeline` as the market-facing identity for `XS Integrator`, `Extra Small Integrator`, and `ENC-FC-XS`. It does not merge Small, Medium, Large, or Custom Integrator members into Homeline.

## Normalized visual assets

| File | PDF page | Original embedded image | SHA-256 | Authority |
| --- | ---: | --- | --- | --- |
| `integrator-unistrut-mounting-owner-pdf-page-3.png` | 3 | image 1, rotated 90 degrees to apply the PDF placement transform | `6fd6a066fabdda02e6a84a7a39d69ae3d2dce244d027702e58f6120287579865` | Unistrut mounting detail |
| `integrator-sealed-door-interior-owner-pdf-page-3.png` | 3 | image 2 | `ba3ff2dea08b7b192919199f270a8aa6da3ecaea2a01af36f601d4e1b66e495b` | sealed doorway/interior detail |
| `integrator-lock-owner-pdf-page-3.png` | 3 | image 5 | `d127ba7ee44882fa4621f4e6dbec187493c3f6c28e25fca97713388a83dd6fe5` | lock detail |
| `integrator-open-interior-owner-pdf-page-4.png` | 4 | image 1 | `ff88d3a3bfb941c4c2ac2fbd5782632751f67239415248d25dee6c117e5778e8` | insulation and projector-shelf detail |

## WordPress media identities

| Authority | Media ID | Canonical source URL | Stored original |
| --- | ---: | --- | --- |
| Unistrut mounting | 12997 | `https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-unistrut-mounting-owner-pdf-page-3.png` | byte-identical |
| Sealed doorway/interior | 12998 | `https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-sealed-door-interior-owner-pdf-page-3.png` | byte-identical |
| Lock detail | 12999 | `https://projectorenclosure.com/wp-content/uploads/2026/09/integrator-lock-owner-pdf-page-3.png` | byte-identical |

The page-4 interior corroborates WordPress media `11972`, the canonical Homeline image. Under the owner-confirmed alias, that media may represent the XS Integrator/Homeline member, but not every Integrator size.

## Fail-closed notes

- Family facts and size-specific facts are separate in `projectorenclosure-integrator-authority.ts`.
- The source wording describes the enclosure as both fan-cooled and closed-loop sealed. Autonomous cooling-topology claims remain blocked until reconciled.
- WordPress-generated derivatives are separate identities and do not replace the checksummed uploaded originals as provenance authority.