/**
 * ART-WORLD-MINIMAP-010 static mount evidence (manifest + PNG inventory + sprite contract).
 * Usage: node scripts/capture-art-world-minimap-010-evidence.mjs
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/art-world-minimap-010");
const manifestPath = path.join(clientRoot, "public/assets/art/v1/manifest.json");

/** Engineering mount bundle (#558); art lane Draft PR read-only when published (not merged #77/#82/#108/#506). */
const ART_SOURCE_NOTE =
  "wave:29 engineering-original 2× sprite / 4 PNG; art Draft PR read-only (do not merge #77/#82/#108/#126/#444/#481/#506)";

const ASSET_IDS = ["ui.minimap.dest.v1", "ui.minimap.legend.v1"];

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
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
        anchor: meta.anchor,
      });
    }
  }

  await mkdir(outDir, { recursive: true });

  const manifestIndex = {
    task: "ART-WORLD-MINIMAP-010",
    source: {
      note: ART_SOURCE_NOTE,
      engineering_issue: "https://github.com/anitaguptaoffice/sanguo-slg/issues/558",
      pattern_prs: [
        "https://github.com/anitaguptaoffice/sanguo-slg/pull/482",
        "https://github.com/anitaguptaoffice/sanguo-slg/pull/509",
        "https://github.com/anitaguptaoffice/sanguo-slg/pull/551",
      ],
    },
    manifest_asset_count: manifest.assets.length,
    minimap_asset_ids: ASSET_IDS,
    png_entries: items.length,
    items,
    generated_at: new Date().toISOString(),
  };

  const hitProof = {
    captured_at: new Date().toISOString(),
    asset_ids: ASSET_IDS,
    kind: "sprite",
    dest_marker: {
      asset_id: "ui.minimap.dest.v1",
      display_logical_px: { w: 14, h: 14 },
      anchor_logical_px: { x: 7, y: 7 },
      canvas_fallback_color: "#c97b63",
      selected_fallback_color: "#f0c674",
    },
    legend_chrome: {
      asset_id: "ui.minimap.legend.v1",
      display_logical_px: { w: 240, h: 14 },
      anchor_logical_px: { x: 0, y: 0 },
      legend_copy: "点=目的格 · 数字=剩余时间",
      legend_constant: "MINIMAP_DEST_ETA_LEGEND",
    },
    runtime_helper: "client/src/engine/artWorldMinimapSkin.ts (CLIENT-139 drawWorldMinimap sprite mount)",
    data_art_skin_off: "CLIENT-139 keeps canvas drawDot / fillText legend; no sprite mount",
    interactive_hit: null,
  };

  const inventoryMd = `# INVENTORY — ART-WORLD-MINIMAP-010

| asset_id | kind | 1× path | 2× path | display (logical) | anchor |
|---|---|---|---|---|---|
| \`ui.minimap.dest.v1\` | sprite | \`textures/1x/ui/minimap_dest.png\` | \`textures/2x/ui/minimap_dest.png\` | 14×14 | center 7,7 |
| \`ui.minimap.legend.v1\` | sprite | \`textures/1x/ui/minimap_legend.png\` | \`textures/2x/ui/minimap_legend.png\` | 240×14 | 0,0 |

**2** manifest ids / **4** PNG. Main tree total **${manifest.assets.length}** manifest entries after mount.

SHA256 per file: see \`manifest-index.json\` \`items[]\`.
`;

  const readme = `# ART-WORLD-MINIMAP-010 client mount evidence

Engineering cherry-pick for **CLIENT-138** ([#558](https://github.com/anitaguptaoffice/sanguo-slg/issues/558)): **2** manifest id / **4** PNG（行军目的点 marker + 图例条 chrome）。Pattern [#482](https://github.com/anitaguptaoffice/sanguo-slg/pull/482) / [#509](https://github.com/anitaguptaoffice/sanguo-slg/pull/509) / [#551](https://github.com/anitaguptaoffice/sanguo-slg/pull/551)。**Not merged**: art hold / VERIFY Drafts (#77 / #82 / #108 / #506 / …)。

## Manifest

- See \`manifest-index.json\` and [INVENTORY.md](./INVENTORY.md)
- Helper: \`client/src/engine/artWorldMinimapSkin.ts\` (\`resolveMinimapDestAssetId\` / \`resolveMinimapLegendAssetId\`)
- Runtime wiring: **CLIENT-139** (\`drawWorldMinimap\` sprite mount)

## 对照说明

| 元素 | asset id | 用途 |
|---|---|---|
| 目的格 marker | \`ui.minimap.dest.v1\` | 替换 canvas 圆点（默认 #c97b63；选中高亮由运行时 tint / 放大） |
| 图例条 chrome | \`ui.minimap.legend.v1\` | 标题行下 \`MINIMAP_DEST_ETA_LEGEND\` 文案前的纸底条；文案仍由代码绘制 |

不含世界瓦片/全屏图集。\`data-art-skin="off"\` 时 CLIENT-139 保留 canvas 回退。

## Regenerate

\`cd client && node scripts/capture-art-world-minimap-010-evidence.mjs\`
`;

  await writeFile(path.join(outDir, "manifest-index.json"), `${JSON.stringify(manifestIndex, null, 2)}\n`);
  await writeFile(path.join(outDir, "hit-proof.json"), `${JSON.stringify(hitProof, null, 2)}\n`);
  await writeFile(path.join(outDir, "INVENTORY.md"), inventoryMd);
  await writeFile(path.join(outDir, "README.md"), readme);
  console.log(`Wrote evidence to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
