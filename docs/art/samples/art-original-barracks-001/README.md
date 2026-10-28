# Original barracks candidate — ART-ORIGINAL-BARRACKS-001

Issue: #1916. New implementation based on repository commit
`ec1723fcad41bb051d79569572ea5c8a691db7a7`; candidate only, not mounted in runtime.

## Composition and contract

An original open training yard, timber palisade, straw dummy, spear/shield rack,
small guard lodge and plain pennant make the military role visible at small size.
No reference images were supplied to generation; no held/reference files were used.
The existing runtime building was inspected for inventory only, not traced or edited.

| File | Pixels | Format | SHA256 |
| --- | --- | --- | --- |
| barracks-1x.png | 220x180 | 8-bit RGBA PNG | d92fe7a7059ee79736c6387c25a60a4b9b8c40c4f06fd96608180c0209cf7b4c |
| barracks-2x.png | 440x360 | 8-bit RGBA PNG | ccc254c5a241461a23fd6404820bee2751a8b59f3c540e7ec524326e4a49b18a |

Asset `mc.building.barracks.v1`, slot `barracks`, sprite, logical 220x180.
Anchor (110,180) in logical pixels; whole transparent canvas preserved, no trim/atlas.
Display (260,520,220,180), hit (250,510,240,200), z 25 are unchanged.
The manifest uses candidate-local paths and `base_url: "./"`; it is not a runtime patch.

## Provenance

Tool: actual built-in `image_gen__imagegen`, one successful generation call,
`transparent_background: true`, no referenced images, no API/CLI synthesis.
Invocation began after 2026-10-28T10:43:35Z; generated file timestamp
2026-10-28T10:44:15.871759708Z. Original: 1386x1135, 8-bit RGBA.
Original SHA256: `611067c7e3b0b81af378020a19159bab39357a7ab7e3b53c0a0ec20bbeea1ff4`.
Original built-in path:
`/home/allyin/.codex/generated_images/01a18216-b11a-7af0-9273-8edce28ea7e0/exec-59528a8c-4bf5-4013-9647-329384e07a25.png`.

Exact prompt:

> Use case: stylized-concept. Asset type: original standalone isometric barracks sprite for a Three Kingdoms browser strategy game. Create ONE completely original composition, with no reference images. Subject: a compact Han-era military training courtyard enclosed along the rear and sides by a low sharpened timber palisade, a small utilitarian timber guard lodge with muted teal tiled roof at the rear left, one clearly visible weapons rack holding three spears and two round shields at the right, and a large straw practice dummy in the open center. A small plain rust-red pennant on a short pole reinforces the military silhouette. No people. The open training yard and defensive stakes must dominate, not an ornate palace roof. Isometric three-quarter view from above, front corner toward the viewer; warm light from upper left; hand-painted polished game illustration, clear chunky shapes, natural wood, ochre packed-earth courtyard, subdued teal roofing and restrained rust-red accents. Single self-contained compact island footprint; no surrounding scenery. Entire silhouette visible with generous transparent padding on all four sides, no clipped spear tips, no cast shadow extending to canvas edges. Target aspect ratio 11:9, composed for export to 440x360 and readability at 176x144. Genuine transparent background, clean antialiased alpha edges; no white or checkerboard background baked in. No text, letters, numbers, logos, watermark, signature, UI, border or extra objects. Output a high-resolution original with detailed but uncluttered materials; preserve broad silhouettes at small scale.

## Deterministic exports

ImageMagick 7.1.2-34; no new image content synthesized.
2x is the high-resolution delivery derived from the generated original;
1x is strictly downscaled from the delivered 2x, not independently generated.
The aspect-preserving fit is centered on the fixed canvas; the logical anchor
remains its bottom center, including transparent safety padding.

```bash
magick original.png -filter Lanczos -resize 424x344 -background none -gravity center -extent 440x360 -depth 8 PNG32:barracks-2x.png
magick barracks-2x.png -filter Lanczos -resize 220x180 -depth 8 PNG32:barracks-1x.png
```

## Checks and visual observations

- PNG IHDR verified: exact dimensions, bit depth 8, color type 6 (RGBA).
- All outer-border alpha bytes are 0; both images contain alpha 0 and 255.
  Partial alpha is preserved (18207 pixels at 1x, 72693 at 2x), not thresholded.
- Candidate validated with `jsonschema.Draft202012Validator` against
  `client/public/assets/art/v1/schema/asset-manifest.schema.json`.
- Viewed exports on light #eee9dd and dark #1a1410 at 220x180 and 176x144.
  Palisade, dummy, shield pair and spear group remain identifiable at 176x144.
  Fine spear bindings and surface detail simplify at that size as expected.
  No clipped spear/pennant, baked text, watermark or signature observed.
  No obvious white halo or opaque rectangular backdrop on either ground.
- This is author visual inspection, not independent approval or browser acceptance.

Local evidence directory:
`/home/allyin/.local/state/sanguo-herdr/20261028/artifacts/art-original-barracks-001/`.
Contains `original.png`, `invocation.json`, `checks.json`, `verify.py`,
`validation.log`, and `light-220.png`, `dark-220.png`,
`light-176.png`, `dark-176.png`. Evidence is local, not deployed game content.

## Pending gates

Independent exact-head review and applicable remote CI remain pending at author handoff.
No client/runtime/schema files changed; no runtime or browser test was performed.
Separate CLIENT integration must verify mounting, DPR selection, anchor placement,
1280x720 DPR1, 1600x900 DPR1 and 1600x900 DPR2, plus rollback.
Candidate approval alone does not establish those results.

