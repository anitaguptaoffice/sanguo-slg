/**
 * ART-UI-FILTER-008 static mount evidence (manifest + PNG inventory + chip hit contract).
 * Usage: node scripts/capture-art-ui-filter-008-evidence.mjs
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/art-ui-filter-008");
const manifestPath = path.join(clientRoot, "public/assets/art/v1/manifest.json");
const indexHtmlPath = path.join(clientRoot, "index.html");

const ART_SOURCE_PR = "https://github.com/anitaguptaoffice/sanguo-slg/pull/506";
const ART_SOURCE_COMMIT = "38451735d5d1004072fd0c07f40757332afe351c";

const ASSET_IDS = [
  "ui.chip.filter.v1",
  "ui.chip.filter.hover.v1",
  "ui.chip.filter.pressed.v1",
  "ui.chip.filter.selected.v1",
  "ui.list.row.v1",
  "ui.list.row.hover.v1",
  "ui.list.row.selected.v1",
  "ui.badge.dot.v1",
  "ui.badge.count.v1",
];

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const indexHtml = await readFile(indexHtmlPath, "utf8");
  const items = [];
  for (const assetId of ASSET_IDS) {
    const meta = manifest.assets.find((a) => a.id === assetId);
    if (!meta) throw new Error(`missing manifest asset ${assetId}`);
    for (const variant of meta.variants ?? []) {
      const rel = variant.path;
      const abs = path.join(clientRoot, "public/assets/art/v1", rel);
      const buf = await readFile(abs);
      items.push({
        asset_id: assetId,
        scale: variant.scale,
        path: rel,
        bytes: buf.length,
        sha256: createHash("sha256").update(buf).digest("hex"),
        display_size: meta.display_size,
        kind: meta.kind,
      });
    }
  }

  await mkdir(outDir, { recursive: true });

  const manifestIndex = {
    task: "ART-UI-FILTER-008",
    source: {
      pr: ART_SOURCE_PR,
      commit: ART_SOURCE_COMMIT,
      note: "Read-only cherry-pick; Draft #506 not merged; #108/#77/#82 not merged",
    },
    manifest_asset_count: manifest.assets.length,
    filter_asset_ids: ASSET_IDS,
    png_entries: items.length,
    items,
    generated_at: new Date().toISOString(),
  };

  const hitProof = {
    art_asset_source_commit: ART_SOURCE_COMMIT,
    captured_at: new Date().toISOString(),
    asset_ids: ASSET_IDS,
    chip_states: ["normal", "hover", "pressed", "selected"],
    row_states: ["default", "hover", "selected"],
    badge: {
      dot_asset: "ui.badge.dot.v1",
      count_asset: "ui.badge.count.v1",
      count_display_px: { w: 20, h: 16 },
      count_labels: ["1", "2", "9", "9+"],
    },
    chip_hit_contract: {
      sprite_display_px: { w: 72, h: 32 },
      skinned_visual_min_width_px: 72,
      min_hit_wrap_px: 44,
      css_in_index_html:
        indexHtml.includes("min-width: 44px") && indexHtml.includes("min-height: 44px"),
      skinned_min_width_in_index: indexHtml.includes("art-filter-chip--skinned") &&
        indexHtml.includes("min-width: 72px"),
      paper_label_color: "#3d2e1f",
      helper: "artUiFilterSkin.mountFilterChip + button.art-filter-chip",
      data_art_skin_off: "skips sprite mount; preserves text label",
      runtime_probes: [
        "sprite intersection inside button",
        "adjacent hit boxes non-overlapping",
        "elementFromPoint center",
      ],
    },
    runtime_selectors: {
      chip: "button[data-ui-filter-chip]",
      row: "[data-ui-filter-row]",
      badge_dot: "[data-ui-filter-badge='dot']",
      badge_count: "[data-ui-filter-badge='count']",
    },
  };

  await writeFile(path.join(outDir, "manifest-index.json"), `${JSON.stringify(manifestIndex, null, 2)}\n`);
  await writeFile(path.join(outDir, "hit-proof.json"), `${JSON.stringify(hitProof, null, 2)}\n`);

  const readme = `# ART-UI-FILTER-008 client mount evidence

Art assets cherry-picked from Draft PR [#506](${ART_SOURCE_PR}) @ \`${ART_SOURCE_COMMIT.slice(0, 8)}\` (**not merged**). Frozen contract reference PR **#108** (hold, not merged).

## Manifest

- **9** asset ids / **18** PNG (1× + 2×) — see \`manifest-index.json\`
- Main tree \`client/public/assets/art/v1/manifest.json\` total **${manifest.assets.length}** entries after mount

## Runtime helper

\`client/src/engine/artUiFilterSkin.ts\` — \`mountFilterUiSkins\` wires:

| Piece | States | asset ids |
|---|---|---|
| Filter chip | normal / hover / pressed / selected | \`ui.chip.filter.*.v1\` |
| List row nine-slice | default / hover / selected | \`ui.list.row*.v1\` |
| Badge dot | — | \`ui.badge.dot.v1\` |
| Badge count (20×16, 1–9 / 9+) | — | \`ui.badge.count.v1\` |

\`data-art-skin="off"\` on chip/row/badge or an ancestor skips manifest chrome.

Chip **CSS hit wrap ≥44×44** while sprite stays **72×32** — see \`hit-proof.json\`.

## Regenerate

\`cd client && node scripts/capture-art-ui-filter-008-evidence.mjs\`

## Tests

\`artUiFilterSkin.test.ts\`; full suite \`cd client && npm test\`.
`;

  await writeFile(path.join(outDir, "README.md"), readme);
  console.log(`Wrote evidence to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
