#!/usr/bin/env node
// Generates original tiered building sprites for main-city slots.
// Usage: CHROMIUM_PATH=/path/to/chrome node tools/art/generate_building_tiers.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const outRoot = join(root, "client/public/assets/art/v1/textures");
const tiers = [1, 4, 7, 10];

const W = 200;
const H = 160;

const SLOTS = {
  academy: { label: "书院", roof: "#3f6d5a", accent: "#e7d7a8", prop: "scrolls" },
  inn: { label: "客栈", roof: "#8a4a32", accent: "#f0c36b", prop: "lantern" },
  relay: { label: "驿站", roof: "#6b5636", accent: "#d9b25f", prop: "horse" },
  workshop: { label: "工匠作坊", roof: "#6d4c3d", accent: "#cf9a55", prop: "anvil" },
  house: { label: "民房", roof: "#7a5744", accent: "#d8c08a", prop: "well" },
  recruit_hall: { label: "招贤馆", roof: "#4d5f7d", accent: "#cfe0ef", prop: "banner" },
  market: { label: "市场", roof: "#8a6a2f", accent: "#f2cf72", prop: "stalls" },
  stable: { label: "马厩", roof: "#6a4a2f", accent: "#c9a05a", prop: "horses" },
  drill_ground: { label: "校场", roof: "#5b3f2e", accent: "#e2c173", prop: "spears" },
  warehouse: { label: "仓库", roof: "#5e5240", accent: "#d6c08d", prop: "crates" },
  smithy: { label: "铁匠铺", roof: "#4b3a34", accent: "#e07b45", prop: "forge" },
  beacon: { label: "烽火台", roof: "#5c3d2b", accent: "#f0a54a", prop: "fire" },
  diplomacy: { label: "鸿胪寺", roof: "#55626f", accent: "#dfe9f0", prop: "flags" },
  barracks: { label: "军营", roof: "#5a4632", accent: "#d9b06a", prop: "tents" },
  farm: { label: "农田", roof: "#6f6234", accent: "#d8c66a", prop: "crops" },
  lumber: { label: "伐木场", roof: "#4f5c37", accent: "#bfa46a", prop: "logs" },
  quarry: { label: "采石场", roof: "#5c5a55", accent: "#cfc6b4", prop: "rocks" },
  iron: { label: "铁矿", roof: "#4a4b4f", accent: "#b9c1cb", prop: "ore" },
  hall: { label: "官府", roof: "#7d2f2f", accent: "#f0d38a", prop: "palace" },
};

const defs = (slot, style) => `
<defs>
  <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${style.roof}"/><stop offset="0.5" stop-color="#2a1d18"/>
    <stop offset="1" stop-color="${style.roof}"/>
  </linearGradient>
  <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d9c9a2"/><stop offset="1" stop-color="#8e7457"/>
  </linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#9a6b45"/><stop offset="1" stop-color="#4e3324"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffe6a3" stop-opacity="0.95"/><stop offset="1" stop-color="#ff9d3c" stop-opacity="0"/>
  </radialGradient>
  <filter id="grain"><feTurbulence baseFrequency="0.9" numOctaves="2" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/><feComponentTransfer>
      <feFuncA type="linear" slope="0.08"/></feComponentTransfer>
    <feComposite operator="over" in2="SourceGraphic"/></filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#120d08" flood-opacity="0.45"/>
  </filter>
</defs>`;

function roofTiles(cx, cy, width, h, colors) {
  let out = `<g filter="url(#shadow)"><path d="M${cx - width / 2} ${cy} Q${cx} ${cy - h * 0.9} ${cx + width / 2} ${cy} L${cx + width / 2 - 10} ${cy + 12} Q${cx} ${cy - h * 0.35} ${cx - width / 2 + 10} ${cy + 12} Z" fill="url(#roof)"/>`;
  out += `<path d="M${cx - width / 2 - 10} ${cy + 2} Q${cx} ${cy + 8} ${cx + width / 2 + 10} ${cy + 2}" stroke="${colors.accent}" stroke-width="3" fill="none"/>`;
  for (let i = -width / 2 + 16; i < width / 2; i += 16) {
    out += `<path d="M${cx + i} ${cy - h * 0.2} L${cx + i + 9} ${cy + 2}" stroke="#1c120d" stroke-opacity="0.35" stroke-width="1.4"/>`;
  }
  out += `<circle cx="${cx - width / 2}" cy="${cy + 2}" r="4" fill="${colors.accent}"/><circle cx="${cx + width / 2}" cy="${cy + 2}" r="4" fill="${colors.accent}"/></g>`;
  return out;
}

function body(tier, style) {
  const w = 96 + tier * 3;
  let out = `<rect x="${W / 2 - w / 2}" y="78" width="${w}" height="${52 + tier}" rx="3" fill="url(#wallG)" stroke="#3b2a1d" stroke-width="2"/>`;
  out += `<rect x="${W / 2 - w / 2 + 7}" y="86" width="${w - 14}" height="${15 + tier}" fill="#5f4933" opacity="0.85"/>`;
  const doorW = 22 + tier;
  out += `<path d="M${W / 2 - doorW / 2} 140 L${W / 2 - doorW / 2} 112 Q${W / 2} 99 ${W / 2 + doorW / 2} 112 L${W / 2 + doorW / 2} 140 Z" fill="url(#wood)" stroke="#2b1b11" stroke-width="2"/>`;
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const x = W / 2 + i * (w / 6);
    out += `<rect x="${x - 6}" y="${104 + tier / 2}" width="12" height="12" fill="#f4d98a" opacity="0.8" stroke="#3b2a1d"/>`;
  }
  out += `<rect x="${W / 2 - w / 2 - 14}" y="80" width="8" height="${50 + tier}" fill="#6b4a2f"/>`;
  out += `<rect x="${W / 2 + w / 2 + 6}" y="80" width="8" height="${50 + tier}" fill="#6b4a2f"/>`;
  return out;
}

function props(kind, tier, style) {
  const t = tier / 10;
  switch (kind) {
    case "crops":
      return `<g>${[...Array(10)].map((_, i) => `<path d="M${30 + i * 15} 138 Q${33 + i * 15} ${120 - (i % 3) * 6} ${36 + i * 15} 138" stroke="#7c8f3a" stroke-width="3" fill="none"/>`).join("")}</g>`;
    case "logs":
      return `<g>${[...Array(5)].map((_, i) => `<rect x="${24 + i * 10}" y="${128 - i * 4}" width="46" height="12" rx="6" fill="#7a5330" stroke="#3a2515"/>`).join("")}<circle cx="30" cy="134" r="5" fill="#c9a06a"/></g>`;
    case "rocks":
      return `<g><path d="M24 142 L38 116 L52 142 Z" fill="#9b978c" stroke="#4f4c45"/><path d="M150 144 L166 112 L184 144 Z" fill="#b2ada0" stroke="#4f4c45"/><circle cx="48" cy="146" r="7" fill="#7f7b72"/></g>`;
    case "ore":
      return `<g><path d="M22 142 L34 124 L46 142 Z" fill="#6e737b"/><path d="M154 142 L168 120 L182 142 Z" fill="#7c828c"/><circle cx="40" cy="132" r="4" fill="#d3a85f"/><circle cx="170" cy="130" r="4" fill="#c98b4d"/></g>`;
    case "anvil":
      return `<g><rect x="146" y="128" width="28" height="10" fill="#3b3b3e"/><path d="M150 128 Q160 112 174 128" fill="#59595e"/><circle cx="162" cy="120" r="16" fill="url(#glow)" opacity="${0.55 + t * 0.4}"/></g>`;
    case "forge":
      return `<g><rect x="148" y="120" width="30" height="20" fill="#3a2a22"/><circle cx="163" cy="126" r="${8 + tier}" fill="url(#glow)"/><path d="M156 108 Q163 96 170 108" stroke="#e07b45" stroke-width="3" fill="none"/></g>`;
    case "fire":
      return `<g><rect x="148" y="86" width="24" height="54" fill="#6b4a2f" stroke="#2b1b11"/><circle cx="160" cy="80" r="${12 + tier}" fill="url(#glow)"/><path d="M154 84 Q160 62 166 84" fill="#ffb347" opacity="0.9"/></g>`;
    case "flags":
      return `<g><rect x="26" y="62" width="3" height="80" fill="#5a3b25"/><path d="M29 66 L62 76 L29 88 Z" fill="${style.accent}"/><rect x="172" y="62" width="3" height="80" fill="#5a3b25"/><path d="M172 66 L140 76 L172 88 Z" fill="#c98b4d"/></g>`;
    case "banner":
      return `<g><rect x="26" y="58" width="4" height="84" fill="#4a3222"/><path d="M30 62 L58 72 L30 84 Z" fill="#c94f4f" stroke="#7c2f2f"/></g>`;
    case "tents":
      return `<g><path d="M18 142 L42 108 L66 142 Z" fill="#8b7b5b" stroke="#4a3d29"/><path d="M134 142 L160 104 L186 142 Z" fill="#8b7b5b" stroke="#4a3d29"/><path d="M42 108 L42 142" stroke="#4a3d29"/></g>`;
    case "spears":
      return `<g>${[...Array(5)].map((_, i) => `<path d="M${128 + i * 12} 142 L${132 + i * 12} ${94 - i * 2}" stroke="#5a3b25" stroke-width="2"/><path d="M${132 + i * 12} ${94 - i * 2} l3 -9 l3 9 z" fill="#b9c1cb"/>`).join("")}</g>`;
    case "crates":
      return `<g>${[...Array(3)].map((_, i) => `<rect x="${20 + i * 18}" y="${128 - i * 8}" width="24" height="22" fill="#9a7546" stroke="#4a3222"/><path d="M${20 + i * 18} ${128 - i * 8} l24 22 M${44 + i * 18} ${128 - i * 8} l-24 22" stroke="#4a3222"/>`).join("")}</g>`;
    case "lantern":
      return `<g><circle cx="160" cy="104" r="8" fill="#d94f3d"/><rect x="158" y="94" width="4" height="6" fill="#4a3222"/><circle cx="160" cy="104" r="16" fill="url(#glow)" opacity="0.45"/></g>`;
    case "stalls":
      return `<g><rect x="18" y="118" width="34" height="24" fill="#9a7546"/><path d="M14 118 L26 102 L38 118 L50 102 L54 118" stroke="#c94f4f" stroke-width="5" fill="none"/><circle cx="28" cy="124" r="4" fill="#e7c35a"/><circle cx="42" cy="126" r="4" fill="#7c9a4a"/></g>`;
    case "horses":
      return `<g><path d="M18 142 Q26 126 38 130 L46 142" fill="#7a5a3a"/><path d="M154 142 Q162 126 174 130 L182 142" fill="#8a6a48"/><circle cx="40" cy="128" r="3" fill="#2b1b11"/></g>`;
    case "well":
      return `<g><rect x="24" y="130" width="32" height="12" fill="#8f8778"/><path d="M28 130 Q40 116 52 130" stroke="#5a3b25" fill="none" stroke-width="3"/></g>`;
    case "scrolls":
      return `<g><rect x="150" y="112" width="30" height="8" fill="#e7d7a8" stroke="#6b5636"/><rect x="152" y="122" width="26" height="7" fill="#d9c38a" stroke="#6b5636"/><circle cx="165" cy="108" r="9" fill="url(#glow)" opacity="0.4"/></g>`;
    case "palace":
      return `<g><rect x="86" y="56" width="28" height="24" fill="#8e2f2f" stroke="#3a1d16"/><path d="M78 58 L100 42 L122 58 Z" fill="${style.accent}"/><path d="M100 42 L100 28" stroke="#c9a05a" stroke-width="3"/></g>`;
    case "wall":
      return `<g>${[...Array(7)].map((_, i) => `<rect x="${36 + i * 19}" y="${104 - (i % 2) * 8}" width="16" height="${14 + (i % 2) * 8}" fill="#8f8778" stroke="#4a443a"/>`).join("")}</g>`;
    case "horse":
      return `<g><path d="M30 140 Q36 124 48 128 L56 140" fill="#7a5a3a"/><rect x="22" y="132" width="24" height="8" fill="#6b4a2f"/></g>`;
    default:
      return "";
  }
}

function banner(tier) {
  const marks = { 1: "新", 4: "兴", 7: "盛", 10: "极" };
  return `<g><rect x="${W / 2 - 3}" y="18" width="6" height="34" fill="#5a3b25"/><path d="M${W / 2 + 3} 22 L${W / 2 + 34} 30 L${W / 2 + 3} 40 Z" fill="#c94f4f" stroke="#7c2f2f"/><text x="${W / 2 + 18}" y="35" font-size="10" text-anchor="middle" fill="#ffe9b0">${marks[tier]}</text></g>`;
}

function svgFor(slot, tier) {
  const style = SLOTS[slot];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs(slot, style)}
  <ellipse cx="100" cy="146" rx="88" ry="12" fill="#100c08" opacity="0.35"/>
  <g filter="url(#shadow)">
    ${body(tier, style)}
    ${roofTiles(100, 84, 104 + tier * 2, 52 + tier, style)}
    ${props(style.prop, tier, style)}
    ${banner(tier)}
    <path d="M20 146 L180 146" stroke="#5a4a35" stroke-width="3" opacity="0.8"/>
  </g>
</svg>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const slot of Object.keys(SLOTS)) {
  for (const tier of tiers) {
    const width = slot === "hall" ? W * 1.6 : W;
    const height = slot === "hall" ? H * 1.5 : H;
    for (const [scale, size] of [[1, width], [2, width * 2]]) {
      const pxH = slot === "hall" ? height * scale : (H * size) / W;
      const page = await browser.newPage({ viewport: { width: size, height: pxH }, deviceScaleFactor: 1 });
      const svg = svgFor(slot, tier);
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${pxH}px;display:block}</style>${svg}`);
      const dir = join(outRoot, `${scale}x`, "maincity", "buildings");
      mkdirSync(dir, { recursive: true });
      const path = join(dir, `${slot}_lv${tier}.png`);
      await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: size, height: pxH } });
      await page.close();
    }
  }
  console.log(`generated ${slot}`);
}
await browser.close();

// Manifest entries.
const manifestPath = join(root, "client/public/assets/art/v1/manifest.json");
const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(manifestPath, "utf8"));
const byId = new Map(manifest.assets.map((a) => [a.id, a]));
for (const slot of Object.keys(SLOTS)) {
  const baseId = `mc.building.${slot}.v1`;
  const base = byId.get(baseId);
  const display = base?.display_size ?? { w: W, h: H };
  const anchor = base?.anchor ?? { x: 100, y: H };
  for (const tier of tiers) {
    const id = `${baseId}.lv${tier}`;
    const entry = {
      id,
      kind: "sprite",
      display_size: { w: display.w, h: display.h },
      anchor: { x: anchor.x, y: anchor.y },
      anchor_unit: "pixels",
      variants: [
        { scale: 1, path: `textures/1x/maincity/buildings/${slot}_lv${tier}.png` },
        { scale: 2, path: `textures/2x/maincity/buildings/${slot}_lv${tier}.png` },
      ],
      tags: ["building-tier", slot, `lv${tier}`],
    };
    if (byId.has(id)) Object.assign(byId.get(id), entry);
    else manifest.assets.push(entry);
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest updated: ${manifest.assets.length} assets`);
