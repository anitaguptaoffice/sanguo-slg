# World terrain proposal — NOT FROZEN

## Established facts
- [Issue #2084](https://github.com/anitaguptaoffice/sanguo-slg/issues/2084) owns this documentation-only exploration.
- `internal/world/chunk.go` blob `9cb45ca34a0adeee4e82a024027d8dec5c78a128`: terrain 0 plain, 1 mountain, 2 water. MapSize 500 and ChunkSize 50 count cells, not pixels.
- `internal/world/generate.go` blob `838741994b8c9c8407db8d97658515fa8d504025`: resource_type and resource_level are separate; no resource overlay belongs to this batch.
- `client/src/ui/worldMinimap.ts` blob `b9491762b38afac213dca4c1a0cd4cfb02556510`: 270x210 normal / 340x252 narrow minimap; world coordinates transform by bounds, pan and zoom. There is no fixed 48/64px terrain host here.
- `client/src/ui/drawWorldMinimap.ts` blob `3ac3b3fac6b4762e678380b40352e1c4cb217d2a`: current map draws markers, routes and labels, not terrain cells.
- `spec/proto/sanguo/world/v1/world.proto` blob `e40ea9e0426c7deb00b695c2cc062112620d9c4a`: city list / CreateCity only, not a terrain-cell retrieval contract.
- `docs/art/maincity-slots.md` explicitly says world pixels TBD; 48–64 is an assumption, not approval. Main-city display dimensions must not be reused.
- Main production manifest blob `a277271b4980771fdb31768158d10a9fa46a893b` contains no terrain textures. Existing PR #575 is minimap chrome, not terrain.

## Exploration choices, not integration requirements
- One opaque full-bleed concept per existing terrain type; no invented forest/desert/snow types.
- Plain: low grassy relief and ochre soil; mountain: broad rocky peaks and green foothills; water: blue-jade open water.
- Painted 2.5D natural materials, simplified forms, upper-left warm light; no imported reference art.
- These images explore material and palette only. Their oblique view is not an approved geometric projection.
- Actual masters are 1254x1254 RGB, unmodified tool outputs. Requested 1024 was not the returned size.
- No stable asset_id or production pack entry is assigned. Names are local concept labels only.
- The static 64px thumbnail is a readability probe, not a proposed or accepted world-cell size.

## Decisions required before production tiles
1. Approve the real host and projection: a dedicated world map or other view; orthogonal/isometric transform and camera.
2. Define logical cell footprint, image extent, ground anchor, overlap and layer order, then the genuine 1x/2x pixel sizes.
3. Define adjacency and edge treatment. Current full-bleed concepts have no matching edge constraints; water/mountain boundary content cannot substitute for shoreline or transition tiles.
4. Define sampling/LOD, zoom behavior, maximum visible cell count and performance/loading limits.
5. Specify terrain data availability and authority. Any new protocol belongs to a separate SPEC-only review, not this art package.
6. Approve finite asset list and stable IDs, fallback behavior, ownership and independent production-delivery scope.

## Gates retained
- No runtime files, schema, proto, DB or map-generation changes in this card.
- No use of these images in production until a separately reviewed contract and delivery permit it.
- No seamlessness, grid composition, click behavior, browser rendering or runtime acceptance claimed.
- Do not merge historical art/reference/VERIFY holds or copy their content to evade a hold.
- Successor policy permits this independent proposal; it does not retroactively freeze world sizes or waive review.
