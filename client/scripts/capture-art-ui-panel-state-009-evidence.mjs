/**
 * ART-UI-PANEL-STATE-009 static mount evidence (manifest + PNG inventory + nine-slice contract).
 * Usage: node scripts/capture-art-ui-panel-state-009-evidence.mjs
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/art-ui-panel-state-009");
const manifestPath = path.join(clientRoot, "public/assets/art/v1/manifest.json");

/** Engineering mount bundle (#532); art lane Draft PR read-only (not merged), pattern #509 / Draft #506. */
const ART_SOURCE_NOTE =
  "wave:28 engineering-original 3× nine_slice / 6 PNG; art Draft PR pending (do not merge #77/#82/#108/#506)";

const ASSET_IDS = ["ui.panel.loading.v1", "ui.panel.empty.v1", "ui.panel.error.v1"];

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
        nine_slice: meta.nine_slice,
      });
    }
  }

  await mkdir(outDir, { recursive: true });

  const manifestIndex = {
    task: "ART-UI-PANEL-STATE-009",
    source: {
      note: ART_SOURCE_NOTE,
      engineering_issue: "https://github.com/anitaguptaoffice/sanguo-slg/issues/532",
      pattern_prs: ["https://github.com/anitaguptaoffice/sanguo-slg/pull/482", "https://github.com/anitaguptaoffice/sanguo-slg/pull/509"],
    },
    manifest_asset_count: manifest.assets.length,
    panel_state_asset_ids: ASSET_IDS,
    png_entries: items.length,
    items,
    generated_at: new Date().toISOString(),
  };

  const hitProof = {
    captured_at: new Date().toISOString(),
    asset_ids: ASSET_IDS,
    kind: "nine_slice",
    display_logical_px: { w: 320, h: 120 },
    nine_slice_logical_px: { left: 16, top: 16, right: 16, bottom: 16 },
    state_to_asset: {
      loading: "ui.panel.loading.v1",
      empty: "ui.panel.empty.v1",
      error: "ui.panel.error.v1",
    },
    runtime_helper: "client/src/engine/artPanelStateSkin.ts — resolvePanelStateAssetId (CLIENT-129 panelStateChrome)",
    data_art_skin_off: "CLIENT-129 falls back to panelDensity / CLIENT-067 copy; no sprite mount",
    data_panel_state_attr: "data-panel-state=loading|empty|error (CLIENT-129)",
    interactive_hit: null,
  };

  const inventoryMd = `# INVENTORY — ART-UI-PANEL-STATE-009

| asset_id | kind | 1× path | 2× path | display (logical) | nine_slice L/T/R/B |
|---|---|---|---|---|---|
| \`ui.panel.loading.v1\` | nine_slice | \`textures/1x/ui/panel_loading.png\` | \`textures/2x/ui/panel_loading.png\` | 320×120 | 16 |
| \`ui.panel.empty.v1\` | nine_slice | \`textures/1x/ui/panel_empty.png\` | \`textures/2x/ui/panel_empty.png\` | 320×120 | 16 |
| \`ui.panel.error.v1\` | nine_slice | \`textures/1x/ui/panel_error.png\` | \`textures/2x/ui/panel_error.png\` | 320×120 | 16 |

**3** manifest ids / **6** PNG. Main tree total **${manifest.assets.length}** manifest entries after mount.

SHA256 per file: see \`manifest-index.json\` \`items[]\`.
`;

  const readme = `# ART-UI-PANEL-STATE-009 client mount evidence

Engineering cherry-pick for **CLIENT-128** ([#532](https://github.com/anitaguptaoffice/sanguo-slg/issues/532)): **3** manifest id / **6** PNG (loading / empty / error nine-slice). Pattern [#482](https://github.com/anitaguptaoffice/sanguo-slg/pull/482) / [#509](https://github.com/anitaguptaoffice/sanguo-slg/pull/509). **Not merged**: art hold / VERIFY Drafts (#77 / #82 / #108 / #506 / …).

## Manifest

- See \`manifest-index.json\` and [INVENTORY.md](./INVENTORY.md)
- Helper: \`client/src/engine/artPanelStateSkin.ts\` (\`resolvePanelStateAssetId\`)
- Runtime wiring: **CLIENT-129** (\`panelStateChrome\`)

## 对照说明

| 面板态 | asset id | 用途 |
|---|---|---|
| loading | \`ui.panel.loading.v1\` | 首屏拉取骨架纸底 |
| empty | \`ui.panel.empty.v1\` | 列表/筛选空结果纸底 |
| error | \`ui.panel.error.v1\` | 网关/拉取错误纸底 |

文案与动效由代码绘制；图内无烘焙文字。\`data-art-skin="off"\` 时 CLIENT-129 回退 CLIENT-067 纯文案。

## Regenerate

\`cd client && node scripts/capture-art-ui-panel-state-009-evidence.mjs\`
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
