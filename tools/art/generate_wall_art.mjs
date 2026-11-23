#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const manifestPath = join(root, "client/public/assets/art/v1/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

const W = 640, H = 120, tiers = [1, 4, 7, 10];
function wallSvg(tier) {
  const towerH = 32 + tier * 2;
  const wallH = 34 + tier * 2;
  const gateW = 34 + tier;
  const flags = tier === 1 ? 1 : tier === 4 ? 2 : tier === 7 ? 3 : 4;
  const stones = [];
  for (let x = 20; x < W - 20; x += 34) {
    stones.push(`<rect x="${x}" y="${82 - wallH / 2 + ((x / 34) % 2) * 5}" width="28" height="10" rx="2" fill="#b8ab90" stroke="#4c4438" stroke-opacity="0.6"/>`);
  }
  const towers = [80, W - 80].map((x) => `
    <g>
      <rect x="${x - 28}" y="${70 - towerH}" width="56" height="${towerH}" fill="#c4b596" stroke="#3e3428" stroke-width="2"/>
      <path d="M${x - 38} ${70 - towerH} L${x} ${54 - towerH} L${x + 38} ${70 - towerH} Z" fill="#7d2f2f" stroke="#3a1d16" stroke-width="2"/>
      <rect x="${x - 10}" y="${54 - towerH}" width="20" height="14" fill="#f0d38a"/>
      <rect x="${x - 3}" y="${40 - towerH}" width="6" height="${towerH - 20}" fill="#5a3b25"/>
      <path d="M${x + 3} ${42 - towerH} L${x + 24} ${48 - towerH} L${x + 3} ${56 - towerH} Z" fill="#c94f4f"/>
    </g>`).join("");
  const flagMarks = [...Array(flags)].map((_, i) => `<g><rect x="${200 + i * 70}" y="24" width="3" height="38" fill="#5a3b25"/><path d="M${203 + i * 70} 27 L${232 + i * 70} 34 L${203 + i * 70} 43 Z" fill="#c94f4f"/></g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c9a2"/><stop offset="1" stop-color="#8e7457"/></linearGradient>
  <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a3a32"/><stop offset="1" stop-color="#3a1d16"/></linearGradient>
  <filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#120d08" flood-opacity="0.45"/></filter></defs>
  <ellipse cx="${W / 2}" cy="108" rx="${W / 2 - 8}" ry="9" fill="#100c08" opacity="0.35"/>
  <g filter="url(#s)">
    <rect x="14" y="${70 - wallH / 2}" width="${W - 28}" height="${wallH + 10}" fill="url(#stone)" stroke="#3b2a1d" stroke-width="2"/>
    ${[...Array(Math.ceil((W - 40) / 34))].map((_, i) => `<rect x="${22 + i * 34}" y="${70 - wallH / 2 - 10}" width="18" height="12" fill="#c4b596" stroke="#3b2a1d" stroke-width="1.5"/>`).join("")}
    ${stones.join("")}
    <path d="M${W / 2 - gateW / 2} 96 L${W / 2 - gateW / 2} ${62} Q${W / 2} ${44} ${W / 2 + gateW / 2} ${62} L${W / 2 + gateW / 2} 96 Z" fill="url(#roof)" stroke="#2b1b11" stroke-width="2"/>
    ${towers}
    ${flagMarks}
    <path d="M10 104 L${W - 10} 104" stroke="#5a4a35" stroke-width="3" opacity="0.85"/>
  </g></svg>`;
}

for (const tier of tiers) {
  for (const [scale, width] of [[1, W], [2, W * 2]]) {
    const height = scale === 1 ? H : H * 2;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${width}px;height:${height}px;display:block}</style>${wallSvg(tier)}`);
    const dir = join(root, `client/public/assets/art/v1/textures/${scale}x/maincity/buildings`);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `wall_lv${tier}.png`), omitBackground: true, clip: { x: 0, y: 0, width, height } });
    await page.close();
  }
}

const defenses = [
  [1, "trap", "陷阱", "#7a5a3a"], [2, "stakes", "拒马", "#8a6a45"], [3, "tower", "箭塔", "#8a3a32"],
  [4, "log", "滚木", "#6a4a2f"], [5, "rock", "礌石", "#6e737b"],
];
function defenseSvg(code, kind, color) {
  let art = "";
  switch (kind) {
    case "trap": art = `<path d="M10 52 L22 28 L34 52 L46 28 L58 52" stroke="#d8c08a" stroke-width="4" fill="none"/><path d="M12 52 H54" stroke="#5a3b25" stroke-width="3"/><circle cx="22" cy="30" r="3" fill="#c94f4f"/><circle cx="46" cy="30" r="3" fill="#c94f4f"/>`; break;
    case "stakes": art = `<path d="M14 52 L50 14 M50 52 L14 14" stroke="#8a6a45" stroke-width="8" stroke-linecap="round"/><path d="M14 52 L50 14 M50 52 L14 14" stroke="#d8c08a" stroke-width="2"/><path d="M18 16 l6 -6 M46 16 l-6 -6" stroke="#d8d8d8" stroke-width="3"/>`; break;
    case "tower": art = `<rect x="22" y="26" width="22" height="30" fill="#c4b596" stroke="#3a2a1a" stroke-width="2"/><path d="M16 26 L33 10 L50 26 Z" fill="#8a3a32"/><rect x="29" y="38" width="8" height="12" fill="#f0d38a"/><path d="M33 10 V4" stroke="#5a3b25" stroke-width="2"/>`; break;
    case "log": art = `<rect x="12" y="22" width="42" height="12" rx="6" fill="#7a5330" stroke="#3a2515"/><rect x="16" y="38" width="42" height="12" rx="6" fill="#8a6038" stroke="#3a2515"/><circle cx="15" cy="28" r="4" fill="#c9a06a"/><circle cx="19" cy="44" r="4" fill="#c9a06a"/>`; break;
    default: art = `<path d="M14 52 L26 22 L40 46 L48 30 L58 52 Z" fill="#9b978c" stroke="#4f4c45" stroke-width="2"/><circle cx="26" cy="34" r="4" fill="#7f7b72"/>`; break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><radialGradient id="b"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#20160f"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#b)" stroke="#d8b06a" stroke-width="2"/>${art}</svg>`;
}
for (const [, code, , color] of defenses) {
  for (const [scale, size] of [[1, 64], [2, 128]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${defenseSvg(code, code, color)}`);
    const dir = join(root, `client/public/assets/art/v1/textures/${scale}x/icons/wall`);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `defense_${code}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
  }
}
await browser.close();

const byId = new Map(manifest.assets.map((a) => [a.id, a]));
const base = byId.get("mc.building.wall.v1");
for (const tier of tiers) {
  const id = `mc.building.wall.v1.lv${tier}`;
  const entry = { id, kind: "sprite", display_size: base.display_size, anchor: base.anchor, anchor_unit: "pixels",
    variants: [{ scale: 1, path: `textures/1x/maincity/buildings/wall_lv${tier}.png` },
      { scale: 2, path: `textures/2x/maincity/buildings/wall_lv${tier}.png` }],
    tags: ["building-tier", "wall", `lv${tier}`] };
  if (byId.has(id)) Object.assign(byId.get(id), entry); else manifest.assets.push(entry);
}
for (const [, code] of defenses) {
  const id = `wall.defense.${code}.v1`;
  const entry = { id, kind: "icon", display_size: { w: 48, h: 48 }, anchor: { x: 24, y: 24 }, anchor_unit: "pixels",
    variants: [{ scale: 1, path: `textures/1x/icons/wall/defense_${code}.png` },
      { scale: 2, path: `textures/2x/icons/wall/defense_${code}.png` }],
    tags: ["wall-defense"] };
  if (byId.has(id)) Object.assign(byId.get(id), entry); else manifest.assets.push(entry);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`wall tiers + ${defenses.length} defense icons; manifest ${manifest.assets.length}`);
