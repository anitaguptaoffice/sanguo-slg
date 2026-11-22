#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const items = [
  [101, "helmet", "#8a6a45"], [102, "helmet", "#8a8a95"], [103, "helmet", "#4a4a5a"],
  [201, "armor", "#8a6a45"], [202, "armor", "#8a8a95"], [203, "armor", "#4a4a5a"],
  [301, "sword", "#8a6a45"], [302, "spear", "#8a8a95"], [303, "blade", "#5a7a6a"],
  [401, "horse", "#9a7a45"], [402, "horse", "#4a4a55"], [403, "horse", "#a03a2a"],
  [501, "gem", "#7a9a6a"], [502, "gem", "#9aa0b0"], [503, "gem", "#6a9a8a"],
  [601, "gem2", "#b05a4a"], [602, "gem2", "#5a7ab0"], [603, "gem2", "#7ab05a"],
  [604, "gem2", "#b0a04a"], [605, "gem2", "#8a5ab0"], [606, "gem2", "#b05a8a"],
];

function shape(kind) {
  switch (kind) {
    case "helmet": return `<path d="M18 38 Q18 14 32 14 Q46 14 46 38 L40 38 Q40 24 32 24 Q24 24 24 38 Z" fill="#d9c9a2" stroke="#2a1a10" stroke-width="2"/><rect x="24" y="36" width="16" height="6" fill="#8a6a45"/>`;
    case "armor": return `<path d="M20 18 L26 14 H38 L44 18 L46 46 H18 Z" fill="#c9a06a" stroke="#2a1a10" stroke-width="2"/><path d="M32 18 V46 M22 30 H42" stroke="#6a4a2a" stroke-width="2"/>`;
    case "sword": return `<path d="M32 10 L38 18 L36 44 L32 54 L28 44 L26 18 Z" fill="#d8d8e0" stroke="#2a1a10" stroke-width="2"/><path d="M24 40 H40" stroke="#c9a05a" stroke-width="4"/><path d="M32 44 V54" stroke="#6a4a2a" stroke-width="4"/>`;
    case "spear": return `<path d="M30 54 L34 18" stroke="#6a4a2a" stroke-width="3"/><path d="M34 18 L40 10 L36 24 Z" fill="#d8d8e0" stroke="#2a1a10"/><path d="M26 42 Q34 46 42 42" stroke="#c9a05a" stroke-width="3" fill="none"/>`;
    case "blade": return `<path d="M16 46 Q28 14 44 12 Q40 30 22 50 Z" fill="#cfd8d0" stroke="#2a1a10" stroke-width="2"/><path d="M22 46 L16 54" stroke="#6a4a2a" stroke-width="4"/>`;
    case "horse": return `<path d="M14 46 Q18 28 32 28 L40 18 L48 24 L42 34 Q48 44 38 48 L18 48 Z" fill="#c9a06a" stroke="#2a1a10" stroke-width="2"/><path d="M30 34 L26 48 M40 36 L42 48" stroke="#2a1a10" stroke-width="3"/>`;
    case "gem2": return `<path d="M32 12 L48 26 L32 52 L16 26 Z" fill="#d8d8e0" stroke="#2a1a10" stroke-width="2"/><path d="M16 26 H48 M32 12 L24 26 L32 52 L40 26 Z" stroke="#5a5a6a" fill="none"/>`;
    default: return `<path d="M32 12 L46 22 V38 L32 52 L18 38 V22 Z" fill="#d8e0d0" stroke="#2a1a10" stroke-width="2"/><path d="M32 18 L40 24 V36 L32 44 L24 36 V24 Z" fill="#8ab08a"/>`;
  }
}

function svg(kind, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="b"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#20160f"/></radialGradient><filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".45"/></filter></defs><circle cx="32" cy="32" r="30" fill="url(#b)" stroke="#d8b06a" stroke-width="2" filter="url(#s)"/>${shape(kind)}</svg>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const [id, kind, color] of items) {
  for (const [scale, size] of [[1, 64], [2, 128]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg(kind, color)}`);
    const dir = join(root, `client/public/assets/art/v1/textures/${scale}x/icons/equipment`);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `equip_${id}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
  }
}
await browser.close();
const manifestPath = join(root, "client/public/assets/art/v1/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const byId = new Map(manifest.assets.map((a) => [a.id, a]));
for (const [id] of items) {
  const entry = {
    id: `equip.icon.${id}.v1`, kind: "icon",
    display_size: { w: 64, h: 64 }, anchor: { x: 32, y: 32 }, anchor_unit: "pixels",
    variants: [
      { scale: 1, path: `textures/1x/icons/equipment/equip_${id}.png` },
      { scale: 2, path: `textures/2x/icons/equipment/equip_${id}.png` },
    ],
    tags: ["equipment-icon"],
  };
  if (byId.has(entry.id)) Object.assign(byId.get(entry.id), entry);
  else manifest.assets.push(entry);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`equipment icons: ${items.length}; manifest: ${manifest.assets.length}`);
