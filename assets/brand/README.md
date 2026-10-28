# Launchpad official-brand reconstruction

The owner supplied a raster identity image in the conversation on 28 October 2026: ascending cyan/blue bars, a blue human-growth silhouette, navy Launchpad wordmark and `YOUR CAREER, HIGHER.` tagline. These local SVGs reconstruct that supplied identity; they are not a new generic logo. White margins/background and external UI are excluded. No remote font or image request is needed.

- `../launchpad.svg`: reduced growth symbol used by favicon and small/icon contexts.
- `launchpad-lockup-light.svg`, `launchpad-lockup-dark.svg`: transparent, outlined vector lockups. Main application theme controls the variant; callback follows the browser color scheme.
- Matching PNGs: transparent 1300 × 365 browser rasterizations of those SVGs.
- `launchpad-icon-180.png`: white-backed padded iOS/touch icon, rendered from the same vector symbol.

Symbol geometry/gradients were reconstructed by visual comparison. The source font was not supplied: the wordmark/tagline use modified-size DejaVu Sans Bold outlines, with no runtime font dependency. The font license is included in `DEJAVU-LICENSE.txt`. The tagline weight, letterform geometry and exact original kerning need final human approval against the original brand master; do not call this a pixel-identical original vector. Request the original designer's SVG/font information for exact typography if available.

A generated background-removal draft was reviewed and rejected due to edge artifacts; it is not included in public assets. Production PNGs come from the committed SVGs, not that draft.

To rasterize again, serve the repository with `npm start`; open each SVG in Chromium at its viewBox dimensions and take a transparent element screenshot. The regular npm build copies the committed assets and does not require Python, an image-generation service or font tooling.
