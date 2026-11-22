#!/usr/bin/env node
// Generates original 18-unit icons.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const units = [
  [1, "步兵", "infantry", "#8a6a45"], [2, "骑兵", "cavalry", "#9a5a32"],
  [3, "弓兵", "archer", "#5a7a45"], [4, "器械", "siege", "#6b5a48"],
  [5, "民夫", "militia", "#8a7a5a"], [6, "义兵", "levy", "#7a6a4a"],
  [7, "斥候", "scout", "#6a7a8a"], [8, "长枪兵", "spearman", "#7a6a3a"],
  [9, "刀盾兵", "shield", "#6a5a4a"], [10, "长弓手", "longbow", "#4a6a3a"],
  [11, "轻骑", "lightcav", "#a07040"], [12, "铁骑", "heavycav", "#5a5a6a"],
  [13, "西凉铁骑", "xiliang", "#8a4a2a"], [14, "虎豹骑", "hubao", "#6a2a2a"],
  [15, "青州兵", "qingzhou", "#2a5a5a"], [16, "南蛮象兵", "elephant", "#5a4a2a"],
  [17, "藤甲兵", "rattan", "#4a6a3a"], [18, "突骑兵", "tuji", "#7a3a5a"],
];

function icon(name, kind, color) {
  const common = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#241a12"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".5"/></filter></defs><circle cx="32" cy="32" r="29" fill="url(#g)" stroke="#d8b06a" stroke-width="2" filter="url(#s)"/>`;
  let art = "";
  switch (kind) {
    case "infantry": art = `<path d="M32 14 L44 22 V38 Q32 52 20 38 V22 Z" fill="#d9c9a2" stroke="#3a2a1a" stroke-width="2"/><path d="M32 20 V40 M24 28 H40" stroke="#7a4a2a" stroke-width="3"/>`; break;
    case "cavalry": case "lightcav": case "heavycav": case "xiliang": case "hubao": case "tuji":
      art = `<path d="M16 42 Q24 26 34 28 L42 20 L48 26 L42 34 Q46 42 40 46 L20 46 Z" fill="#c9a06a" stroke="#2a1a10" stroke-width="2"/><path d="M30 30 L26 46 M38 32 L40 46" stroke="#2a1a10" stroke-width="3"/>`; break;
    case "archer": case "longbow": art = `<path d="M20 16 Q46 32 20 48" fill="none" stroke="#d8b06a" stroke-width="3"/><path d="M20 16 L20 48" stroke="#e8d9b0"/><path d="M20 32 H44" stroke="#3a2a1a" stroke-width="2"/><path d="M44 28 L50 32 L44 36" fill="#d9c9a2"/>`; break;
    case "siege": art = `<rect x="16" y="30" width="32" height="16" fill="#8a6a45" stroke="#2a1a10" stroke-width="2"/><circle cx="22" cy="48" r="6" fill="#5a4a3a"/><circle cx="42" cy="48" r="6" fill="#5a4a3a"/><path d="M42 30 L50 16" stroke="#d8b06a" stroke-width="3"/><circle cx="50" cy="16" r="4" fill="#b0b0b0"/>`; break;
    case "spearman": art = `<path d="M24 48 L40 12" stroke="#8a6a45" stroke-width="3"/><path d="M40 12 L44 20 L36 20 Z" fill="#d8d8d8"/><path d="M20 26 L36 22 L38 34 L22 38 Z" fill="#c9a06a" stroke="#2a1a10"/>`; break;
    case "shield": art = `<path d="M32 12 L48 20 V34 Q32 50 16 34 V20 Z" fill="#b08a5a" stroke="#2a1a10" stroke-width="2"/><path d="M32 18 V40" stroke="#5a3a22" stroke-width="3"/><path d="M24 24 H40" stroke="#5a3a22" stroke-width="2"/>`; break;
    case "elephant": art = `<path d="M14 38 Q18 20 34 22 L44 18 Q50 22 48 30 L42 34 Q46 44 36 46 L18 46 Z" fill="#9a8a7a" stroke="#2a1a10" stroke-width="2"/><path d="M44 30 Q52 34 48 42" fill="none" stroke="#9a8a7a" stroke-width="4"/>`; break;
    case "rattan": art = `<path d="M32 12 L46 20 V36 Q32 50 18 36 V20 Z" fill="#8a6a3a" stroke="#2a1a10" stroke-width="2"/>${[...Array(4)].map((_, i) => `<path d="M20 ${22 + i * 6} H44" stroke="#5a7a3a" stroke-width="2"/>`).join("")}`; break;
    case "militia": art = `<path d="M24 48 L26 24 H38 L40 48 Z" fill="#b09a6a" stroke="#2a1a10"/><circle cx="32" cy="18" r="7" fill="#d9c9a2" stroke="#2a1a10"/><path d="M16 44 L20 20" stroke="#8a6a45" stroke-width="3"/>`; break;
    case "scout": art = `<path d="M18 42 Q26 24 38 26 L46 18 L50 24 L42 34 Q46 44 38 46 L20 46 Z" fill="#9a8a6a" stroke="#2a1a10" stroke-width="2"/><circle cx="34" cy="34" r="3" fill="#2a1a10"/>`; break;
    default: art = `<path d="M32 14 L44 22 V38 Q32 52 20 38 V22 Z" fill="#c9a06a" stroke="#2a1a10" stroke-width="2"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${common}${art}</svg>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const [id, name, kind, color] of units) {
  for (const [scale, size] of [[1, 64], [2, 128]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${icon(name, kind, color)}`);
    const dir = join(root, `client/public/assets/art/v1/textures/${scale}x/icons/units`);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `unit_${id}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
  }
}
await browser.close();

const manifestPath = join(root, "client/public/assets/art/v1/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const byId = new Map(manifest.assets.map((a) => [a.id, a]));
for (const [id] of units) {
  const entry = {
    id: `unit.icon.${id}.v1`, kind: "icon",
    display_size: { w: 64, h: 64 }, anchor: { x: 32, y: 32 }, anchor_unit: "pixels",
    variants: [
      { scale: 1, path: `textures/1x/icons/units/unit_${id}.png` },
      { scale: 2, path: `textures/2x/icons/units/unit_${id}.png` },
    ],
    tags: ["unit-icon"],
  };
  if (byId.has(entry.id)) Object.assign(byId.get(entry.id), entry);
  else manifest.assets.push(entry);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`unit icons: ${units.length}; manifest: ${manifest.assets.length}`);
