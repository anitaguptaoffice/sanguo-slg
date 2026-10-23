/**
 * Resource integrity for combined full-scene VERIFY (manifest paths, PNG count, release dist exclusion).
 * Usage: node scripts/verify-art-full-scene-inventory.mjs
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const artRoot = path.resolve(clientRoot, "public/assets/art/v1");
const manifestPath = path.resolve(artRoot, "manifest.json");
const outPath = path.resolve(clientRoot, "../docs/art/samples/art-full-scene-combined/INVENTORY.json");

const PROVENANCE = {
  "mc.bg.plateau.v1": { pr: "#126", commit: "d05d68d6d007f66963ebea16eca71bb9da736abc" },
  "mc.building.hall.v1": { pr: "#108", commit: "54394ad49bad4356eb905d3686ca14ac40548282" },
  "mc.building.farm.v1": { pr: "#108", commit: "54394ad49bad4356eb905d3686ca14ac40548282" },
  "ui.button.primary.v1": { pr: "#108", commit: "54394ad49bad4356eb905d3686ca14ac40548282" },
  "ui.panel.default.v1": { pr: "#108", commit: "54394ad49bad4356eb905d3686ca14ac40548282" },
  "res.icon.food.v1": { pr: "#108", commit: "54394ad49bad4356eb905d3686ca14ac40548282" },
  "mc.building.lumber.v1": { pr: "#140/#141", commit: "6b00edf1627789204b0cb98a363f24f24b58711f" },
  "mc.building.quarry.v1": { pr: "#140/#141", commit: "6b00edf1627789204b0cb98a363f24f24b58711f" },
  "mc.building.iron.v1": { pr: "#140/#141", commit: "6b00edf1627789204b0cb98a363f24f24b58711f" },
  "mc.building.barracks.v1": { pr: "#140/#141", commit: "6b00edf1627789204b0cb98a363f24f24b58711f" },
  "mc.building.wall.v1": { pr: "#153/#155", commit: "0d9ea5bc54fb6e61a7df84247d302e435db838f5" },
  "res.icon.wood.v1": { pr: "#144/#145", commit: "feat/ART-ICONS-003-hud-resources" },
  "res.icon.stone.v1": { pr: "#144/#145", commit: "feat/ART-ICONS-003-hud-resources" },
  "res.icon.iron.v1": { pr: "#144/#145", commit: "feat/ART-ICONS-003-hud-resources" },
};

function collectPaths(manifest) {
  const rows = [];
  for (const asset of manifest.assets) {
    const prov = PROVENANCE[asset.id] ?? { pr: "unknown", commit: "unknown" };
    if (asset.variants) {
      for (const v of asset.variants) {
        rows.push({
          asset_id: asset.id,
          scale: v.scale,
          path: v.path,
          provenance_pr: prov.pr,
          provenance_commit: prov.commit,
        });
      }
    } else if (asset.button_states) {
      for (const [state, vars] of Object.entries(asset.button_states)) {
        for (const v of vars) {
          rows.push({
            asset_id: `${asset.id}@${state}`,
            scale: v.scale,
            path: v.path,
            provenance_pr: prov.pr,
            provenance_commit: prov.commit,
          });
        }
      }
    }
  }
  return rows;
}

async function sha256File(abs) {
  const buf = await readFile(abs);
  return createHash("sha256").update(buf).digest("hex");
}

async function walkDist(distDir, prefix = "") {
  const names = await readdir(distDir);
  const out = [];
  for (const name of names) {
    const abs = path.join(distDir, name);
    const st = await stat(abs);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (st.isDirectory()) out.push(...(await walkDist(abs, rel)));
    else out.push(rel);
  }
  return out;
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const rows = collectPaths(manifest);
  const items = [];
  let errors = 0;
  for (const row of rows) {
    const abs = path.resolve(artRoot, row.path);
    try {
      const st = await stat(abs);
      const sha = await sha256File(abs);
      items.push({ ...row, bytes: st.size, sha256: sha, exists: true });
    } catch {
      errors++;
      items.push({ ...row, exists: false });
    }
  }
  const distDir = path.resolve(clientRoot, "dist");
  let distFiles = [];
  try {
    distFiles = await walkDist(distDir);
  } catch {
    /* build may not have run */
  }
  const forbiddenInDist = [
    "docs/art/samples",
    "reference/",
    "preview.png",
    "HD-BACKGROUND",
    "contact-sheet",
    "verify-screenshots",
  ];
  const distViolations = distFiles.filter((f) =>
    forbiddenInDist.some((pat) => f.includes(pat.replace(/\/$/, ""))),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    stable_asset_ids: manifest.assets.length,
    png_paths: items.filter((i) => i.path.endsWith(".png")).length,
    manifest_asset_ids: manifest.assets.map((a) => a.id),
    items,
    integrity: { missing_paths: errors, pass: errors === 0 },
    release_package_exclusion: {
      note: "Production dist must not ship QA docs, reference trees, or static preview bundles from art hold PRs.",
      checked_dist_file_count: distFiles.length,
      violations: distViolations,
      pass: distViolations.length === 0,
    },
    runtime_fixes: {
      layoutViewport: "applyLayoutTransform uses transform() — from VERIFY #145/#141/#155 (e3a204ef lineage)",
      hud: "DOM hud-main-city right-align; canvas draws res.icon.* row — from VERIFY #145",
      wall_slot: "mc.building.wall.v1 on wall slot — from VERIFY #155",
    },
  };
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ stable_asset_ids: report.stable_asset_ids, png_paths: report.png_paths, integrity: report.integrity, release: report.release_package_exclusion.pass }));
  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
