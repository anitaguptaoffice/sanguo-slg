#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const W = 192, H = 160;
const cities = [
  { id: 1, name: "陈留", style: "granary", roof: "#7a4b32", wall: "#c9b08a", accent: "#e7c35a" },
  { id: 2, name: "汝南", style: "river", roof: "#3f5f7a", wall: "#c4c9b6", accent: "#8fd0d8" },
  { id: 3, name: "北海", style: "coastal", roof: "#4a6a5a", wall: "#c8c2a8", accent: "#e2a95a" },
  { id: 4, name: "青州", style: "green", roof: "#3f6d4a", wall: "#c9c2a0", accent: "#8fd08a" },
  { id: 5, name: "南中", style: "tropical", roof: "#6a5a2f", wall: "#b89a6a", accent: "#e0a050" },
  { id: 6, name: "长安", style: "fortress", roof: "#5a3a3a", wall: "#bcae96", accent: "#d8b06a" },
  { id: 7, name: "幽州", style: "north", roof: "#4a4e5a", wall: "#b8b8b0", accent: "#cfe0ef" },
  { id: 8, name: "洛阳", style: "palace", roof: "#8a2f2f", wall: "#d9c9a2", accent: "#f0d38a" },
  { id: 9, name: "永昌", style: "rattan", roof: "#5a6a32", wall: "#a08a5a", accent: "#c9d06a" },
];

const roof = (cx, cy, w, h, color, accent) => `
  <path d="M${cx - w / 2} ${cy} Q${cx} ${cy - h} ${cx + w / 2} ${cy} L${cx + w / 2 - 8} ${cy + 8} Q${cx} ${cy - h * 0.35} ${cx - w / 2 + 8} ${cy + 8} Z" fill="${color}" stroke="#2a1a12" stroke-width="1.5"/>
  <path d="M${cx - w / 2 - 8} ${cy + 1} Q${cx} ${cy + 7} ${cx + w / 2 + 8} ${cy + 1}" stroke="${accent}" stroke-width="2.5" fill="none"/>`;

function svg(city) {
  const { roof: rc, wall, accent, style } = city;
  const towers = style === "palace" ? 3 : style === "fortress" ? 3 : 2;
  const height = style === "palace" ? 66 : style === "fortress" ? 58 : 48;
  let props = "";
  switch (style) {
    case "granary": props = `<g>${[0, 1, 2].map(i => `<rect x="${24 + i * 34}" y="116" width="22" height="26" fill="#b8965a" stroke="#4a3222"/><path d="M22 ${116 + i * 0} l14 -10 l14 10" fill="none" stroke="#4a3222"/>`).join("")}</g>`; break;
    case "river": props = `<path d="M8 140 Q50 128 96 140 T184 140" stroke="#6ab8c8" stroke-width="9" fill="none" opacity="0.8"/>`; break;
    case "coastal": props = `<path d="M6 142 Q58 130 110 142 T186 142" stroke="#58a8b8" stroke-width="8" fill="none" opacity="0.75"/><path d="M150 42 l0 36" stroke="#5a3b25" stroke-width="3"/><path d="M150 44 l20 6 l-20 8z" fill="${accent}"/>`; break;
    case "green": props = `<g>${[0, 1, 2, 3].map(i => `<circle cx="${26 + i * 46}" cy="132" r="12" fill="#4a6a32"/><rect x="${23 + i * 46}" y="132" width="6" height="14" fill="#5a3b25"/>`).join("")}</g>`; break;
    case "tropical": props = `<g><path d="M20 140 Q26 112 38 116 Q44 140 34 146 Z" fill="#5a7a32"/><path d="M158 142 Q164 108 178 114 Q182 140 170 146 Z" fill="#5a7a32"/><circle cx="160" cy="120" r="5" fill="#e0a050"/></g>`; break;
    case "fortress": props = `<g><rect x="12" y="92" width="20" height="48" fill="#a89a82" stroke="#3a2a1a"/><rect x="160" y="86" width="20" height="54" fill="#a89a82" stroke="#3a2a1a"/></g>`; break;
    case "north": props = `<g><path d="M0 146 Q30 132 60 146 T120 146 T192 146" stroke="#d8e6f0" stroke-width="4" fill="none" opacity="0.7"/><path d="M150 54 l0 30" stroke="#5a3b25" stroke-width="3"/><path d="M150 56 l18 5 l-18 7z" fill="#cfe0ef"/></g>`; break;
    case "palace": props = `<g><rect x="78" y="30" width="36" height="26" fill="#9a3a32" stroke="#3a1d16"/><path d="M70 32 L96 14 L122 32 Z" fill="${accent}"/><path d="M96 14 V4" stroke="#c9a05a" stroke-width="3"/><circle cx="96" cy="4" r="3" fill="${accent}"/></g>`; break;
    case "rattan": props = `<g>${[...Array(8)].map((_, i) => `<path d="M${12 + i * 24} 146 L${18 + i * 24} 108" stroke="#8a7a3a" stroke-width="4"/><path d="M${12 + i * 24} 122 H${34 + i * 24}" stroke="#6a5a2f" stroke-width="3"/>`).join("")}</g>`; break;
  }
  const towerEls = [...Array(towers)].map((_, i) => {
    const x = 34 + i * ((W - 68) / Math.max(1, towers - 1));
    return `<g><rect x="${x - 14}" y="${96 - height}" width="28" height="${height}" fill="${wall}" stroke="#3a2a1a" stroke-width="1.5"/>
      ${roof(x, 96 - height, 40, 18, rc, accent)}
      <rect x="${x - 3}" y="${64 - height}" width="6" height="${height - 20}" fill="#5a3b25"/>
      <path d="M${x + 3} ${66 - height} l18 5 l-18 7z" fill="${accent}"/></g>`;
  }).join("");
  const gateW = style === "palace" ? 40 : 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="#6a5540"/></linearGradient>
  <linearGradient id="gateG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a3a2a"/><stop offset="1" stop-color="#2a1a10"/></linearGradient>
  <filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#120d08" flood-opacity="0.5"/></filter></defs>
  <ellipse cx="96" cy="150" rx="84" ry="8" fill="#100c08" opacity="0.35"/>
  <g filter="url(#shadow)">
    <rect x="18" y="92" width="156" height="50" fill="url(#wallG)" stroke="#3a2a1a" stroke-width="2"/>
    ${[...Array(7)].map((_, i) => `<rect x="${22 + i * 22}" y="84" width="14" height="10" fill="${wall}" stroke="#3a2a1a" stroke-width="1.2"/>`).join("")}
    <path d="M${96 - gateW / 2} 142 L${96 - gateW / 2} 108 Q96 94 ${96 + gateW / 2} 108 L${96 + gateW / 2} 142 Z" fill="url(#gateG)" stroke="#1a0f08" stroke-width="2"/>
    ${towerEls}
    <rect x="80" y="70" width="32" height="28" fill="${wall}" stroke="#3a2a1a" stroke-width="1.5"/>
    ${roof(96, 70, 56, 24, rc, accent)}
    ${props}
    <path d="M10 145 L182 145" stroke="#5a4a35" stroke-width="2.5" opacity="0.8"/>
  </g>
</svg>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const city of cities) {
  for (const [scale, size] of [[1, W], [2, W * 2]]) {
    const height = (H * size) / W;
    const page = await browser.newPage({ viewport: { width: size, height } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${height}px;display:block}</style>${svg(city)}`);
    const dir = join(root, `client/public/assets/art/v1/textures/${scale}x/world/special`);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `city_${city.id}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height } });
    await page.close();
  }
}
await browser.close();

const manifestPath = join(root, "client/public/assets/art/v1/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const byId = new Map(manifest.assets.map((a) => [a.id, a]));
for (const city of cities) {
  const entry = { id: `world.obj.special.${city.id}.v1`, kind: "sprite",
    display_size: { w: W, h: H }, anchor: { x: 96, y: 152 }, anchor_unit: "pixels",
    variants: [{ scale: 1, path: `textures/1x/world/special/city_${city.id}.png` },
      { scale: 2, path: `textures/2x/world/special/city_${city.id}.png` }],
    tags: ["special-city-landmark", `city:${city.id}`, city.name] };
  if (byId.has(entry.id)) Object.assign(byId.get(entry.id), entry); else manifest.assets.push(entry);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`special landmarks: ${cities.length}; manifest ${manifest.assets.length}`);
