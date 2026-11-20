/**
 * R1-S6 world map art generator.
 *
 * Draws original vector art in Chromium and exports transparent PNGs at 1x and
 * 2x. Output is deterministic for a given Chromium build; the committed PNGs
 * are the runtime assets and this script is the reproducible source.
 *
 * Usage: node scripts/gen-world-art.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve("public/assets/art/v1/textures");
const TILE_W = 128;
const TILE_H = 64;

function svg(w, h, body, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>${defs}</defs>${body}
  </svg>`;
}

function diamond(fill, extra = "") {
  return `<polygon points="0,32 64,0 128,32 64,64" fill="${fill}"/>${extra}`;
}

const TILES = {
  plain: {
    base: "#6f8f4a",
    body: (() => {
      const tufts = [
        [28, 34], [46, 24], [76, 30], [96, 36], [40, 44], [64, 40], [86, 22], [58, 30],
      ]
        .map(([x, y]) => `<path d="M${x} ${y}l-2 -4M${x} ${y}l0 -5M${x} ${y}l2 -4" stroke="#4d6b31" stroke-width="1.4" fill="none" stroke-linecap="round"/>`)
        .join("");
      return `${diamond("url(#plainG)")}
        <polygon points="0,32 64,0 128,32 64,64" fill="#ffffff" opacity="0.04"/>
        ${tufts}
        <ellipse cx="64" cy="52" rx="34" ry="7" fill="#3f5a28" opacity="0.18"/>`;
    })(),
    defs: `<linearGradient id="plainG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d9d54"/><stop offset="1" stop-color="#5f7d3f"/></linearGradient>`,
  },
  desert: {
    base: "#c9a86a",
    body: (() => {
      const dunes = [
        [20, 36, 34, 8], [58, 26, 42, 10], [92, 40, 28, 7],
      ]
        .map(([x, y, rx, ry]) => `<path d="M${x} ${y}q${rx / 2} -${ry} ${rx} 0" stroke="#b08c50" stroke-width="2" fill="none" opacity="0.7" stroke-linecap="round"/>`)
        .join("");
      return `${diamond("url(#desertG)")}${dunes}
        <circle cx="38" cy="42" r="1.3" fill="#a5814c" opacity="0.8"/>
        <circle cx="78" cy="22" r="1.1" fill="#a5814c" opacity="0.8"/>
        <circle cx="94" cy="40" r="1.4" fill="#e0c78e" opacity="0.9"/>`;
    })(),
    defs: `<linearGradient id="desertG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9ba7c"/><stop offset="1" stop-color="#b9975c"/></linearGradient>`,
  },
  forest: {
    base: "#3f6b3a",
    body: (() => {
      const tree = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
        <rect x="-1.4" y="-4" width="2.8" height="8" fill="#5a4028"/>
        <polygon points="0,-16 9,-2 -9,-2" fill="#2f5a33"/>
        <polygon points="0,-20 7,-8 -7,-8" fill="#3d7042"/>
        <polygon points="0,-23 4.6,-13 -4.6,-13" fill="#4d844c"/>
      </g>`;
      return `${diamond("url(#forestG)")}
        ${tree(40, 36, 1)}${tree(62, 26, 0.9)}${tree(84, 38, 1.05)}${tree(54, 44, 0.75)}
        <ellipse cx="64" cy="52" rx="36" ry="7" fill="#233c1f" opacity="0.22"/>`;
    })(),
    defs: `<linearGradient id="forestG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c7a43"/><stop offset="1" stop-color="#355c31"/></linearGradient>`,
  },
  grass: {
    base: "#87a94f",
    body: (() => {
      const flowers = [[30, 36], [52, 28], [70, 40], [88, 30], [44, 46]]
        .map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="1.8" fill="#f3e6a2"/><circle r="0.8" fill="#d9a441"/></g>`)
        .join("");
      const tufts = [[24, 42], [60, 46], [96, 38], [40, 26], [78, 24]]
        .map(([x, y]) => `<path d="M${x} ${y}q1 -5 3 -7M${x} ${y}q-1 -4 -3 -6" stroke="#6b8c3b" stroke-width="1.3" fill="none" stroke-linecap="round"/>`)
        .join("");
      return `${diamond("url(#grassG)")}${tufts}${flowers}`;
    })(),
    defs: `<linearGradient id="grassG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#97b85c"/><stop offset="1" stop-color="#779845"/></linearGradient>`,
  },
  mountain: {
    base: "#7b7d71",
    body: (() => {
      return `${diamond("url(#mountainG)")}
        <polygon points="34,48 58,14 78,48" fill="#6a6c61"/>
        <polygon points="58,14 66,26 50,26" fill="#e8e8e0" opacity="0.85"/>
        <polygon points="62,50 86,22 106,50" fill="#8a8c80"/>
        <polygon points="86,22 92,32 80,32" fill="#f2f2ea" opacity="0.8"/>
        <polygon points="18,48 34,30 48,48" fill="#5d5f55"/>
        <path d="M28 44l6 -4M78 46l5 -4M96 48l4 -3" stroke="#56584f" stroke-width="1.5" opacity="0.7"/>`;
    })(),
    defs: `<linearGradient id="mountainG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d8f82"/><stop offset="1" stop-color="#6c6e62"/></linearGradient>`,
  },
  lake: {
    base: "#3f7f96",
    body: (() => {
      const waves = [[36, 32], [58, 40], [80, 28], [52, 24], [94, 38]]
        .map(([x, y]) => `<path d="M${x - 8} ${y}q4 -3 8 0t8 0" stroke="#bfe3ec" stroke-width="1.4" fill="none" opacity="0.65" stroke-linecap="round"/>`)
        .join("");
      return `${diamond("url(#lakeG)")}
        <polygon points="10,32 64,4 118,32 64,60" fill="none" stroke="#cfe0b5" stroke-width="2" opacity="0.55"/>
        ${waves}`;
    })(),
    defs: `<linearGradient id="lakeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4e93aa"/><stop offset="1" stop-color="#336c82"/></linearGradient>`,
  },
  swamp: {
    base: "#566b45",
    body: (() => {
      const reeds = [[38, 40], [46, 34], [74, 38], [88, 32]]
        .map(([x, y]) => `<path d="M${x} ${y}v-9M${x + 2} ${y}v-6" stroke="#7d8f4f" stroke-width="1.3" stroke-linecap="round"/>`)
        .join("");
      return `${diamond("url(#swampG)")}
        <ellipse cx="46" cy="40" rx="16" ry="6" fill="#3d5a4a" opacity="0.9"/>
        <ellipse cx="82" cy="30" rx="11" ry="4.5" fill="#3d5a4a" opacity="0.8"/>
        <ellipse cx="70" cy="46" rx="8" ry="3" fill="#496558" opacity="0.8"/>
        ${reeds}
        <circle cx="60" cy="24" r="1.2" fill="#a9b86a" opacity="0.8"/>`;
    })(),
    defs: `<linearGradient id="swampG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#647a4f"/><stop offset="1" stop-color="#4a5e3c"/></linearGradient>`,
  },
  city_ground: {
    base: "#a89a7c",
    body: (() => {
      const lines = [
        "M0 32 L64 64 L128 32", "M64 0 L0 32", "M64 0 L128 32",
        "M32 16 L32 48", "M96 16 L96 48", "M64 0 L64 64",
      ]
        .map((d) => `<path d="${d}" stroke="#8f8064" stroke-width="1" opacity="0.7"/>`)
        .join("");
      return `${diamond("url(#cityG)")}${lines}
        <circle cx="64" cy="32" r="9" fill="#b8a988" stroke="#8d7c5c" stroke-width="1.5"/>
        <circle cx="64" cy="32" r="4" fill="#c9b995"/>`;
    })(),
    defs: `<linearGradient id="cityG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6a889"/><stop offset="1" stop-color="#9c8e70"/></linearGradient>`,
  },
};

function citySprite(tier) {
  const w = 192, h = 160;
  const base = `<ellipse cx="96" cy="146" rx="58" ry="12" fill="#1e2418" opacity="0.22"/>`;
  if (tier === "village") {
    const hut = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
      <polygon points="-18,0 0,-10 18,0 0,10" fill="#d8c49a"/>
      <polygon points="-18,0 -18,-8 0,-18 0,-10" fill="#b8a178"/>
      <polygon points="0,-10 0,-18 18,-8 18,0" fill="#c9b48a"/>
      <polygon points="-22,-8 0,-24 22,-8 0,-4" fill="#8c5a34"/>
      <polygon points="-22,-8 0,-24 0,-20 -18,-6" fill="#a86c3d"/>
      <rect x="-4" y="-6" width="8" height="12" fill="#6b4326"/>
    </g>`;
    return svg(w, h, `${base}${hut(70, 128, 1.2)}${hut(118, 138, 0.95)}${hut(96, 116, 0.8)}
      <path d="M40 142h112" stroke="#5b4a30" stroke-width="2" opacity="0.5"/>`);
  }
  if (tier === "town") {
    const tower = (x, y) => `<g transform="translate(${x} ${y})">
      <rect x="-10" y="-26" width="20" height="26" fill="#b8a582"/>
      <rect x="-12" y="-30" width="24" height="6" fill="#8d7a58"/>
      <polygon points="-14,-30 0,-40 14,-30" fill="#7c4a2c"/>
      <rect x="-4" y="-14" width="8" height="14" fill="#5b432a"/>
    </g>`;
    return svg(w, h, `${base}
      <path d="M28 142h136" stroke="#7d6b4d" stroke-width="10" stroke-linecap="round"/>
      <path d="M28 138h136" stroke="#9d8a66" stroke-width="4" stroke-linecap="round"/>
      ${tower(52, 138)}${tower(140, 138)}
      <g transform="translate(78 126)">
        <rect x="0" y="-22" width="36" height="22" fill="#c8b58e"/>
        <polygon points="-4,-22 18,-36 40,-22" fill="#8c5a34"/>
        <rect x="12" y="-12" width="12" height="12" fill="#5b432a"/>
      </g>
      <g transform="translate(96 100)">
        <rect x="-2" y="-30" width="4" height="30" fill="#6b5436"/>
        <polygon points="2,-30 22,-24 2,-16" fill="#b34a3c"/>
      </g>`);
  }
  return svg(w, h, `${base}
    <path d="M16 142h160" stroke="#6f6046" stroke-width="12" stroke-linecap="round"/>
    <path d="M16 138h160" stroke="#9b8a68" stroke-width="5" stroke-linecap="round"/>
    <g transform="translate(48 138)">
      <rect x="-12" y="-36" width="24" height="36" fill="#b8a582"/>
      <polygon points="-16,-36 0,-48 16,-36" fill="#7c4a2c"/>
      <rect x="-4" y="-20" width="8" height="20" fill="#54402a"/>
    </g>
    <g transform="translate(144 138)">
      <rect x="-12" y="-36" width="24" height="36" fill="#b8a582"/>
      <polygon points="-16,-36 0,-48 16,-36" fill="#7c4a2c"/>
      <rect x="-4" y="-20" width="8" height="20" fill="#54402a"/>
    </g>
    <g transform="translate(96 140)">
      <rect x="-34" y="-52" width="68" height="52" fill="#cbb891"/>
      <rect x="-40" y="-58" width="80" height="8" fill="#8d7a58"/>
      <polygon points="-46,-58 0,-76 46,-58" fill="#87492c"/>
      <polygon points="-46,-58 0,-76 0,-70 -40,-56" fill="#a35c37"/>
      <polygon points="-30,-76 0,-90 30,-76" fill="#9c5632"/>
      <rect x="-10" y="-26" width="20" height="26" fill="#5b432a"/>
      <circle cx="0" cy="-38" r="6" fill="#d9c49a" stroke="#7a603c" stroke-width="1.5"/>
    </g>
    <g transform="translate(96 74)">
      <rect x="-1.5" y="-26" width="3" height="26" fill="#6b5436"/>
      <polygon points="1.5,-26 26,-19 1.5,-11" fill="#d9a93f"/>
      <polygon points="-1.5,-26 -18,-20 -1.5,-14" fill="#b34a3c"/>
    </g>`);
}

function huangjinSprite() {
  const w = 160, h = 144;
  const tent = (x, y, s, color) => `<g transform="translate(${x} ${y}) scale(${s})">
    <polygon points="-26,0 0,-30 26,0" fill="${color}"/>
    <polygon points="-26,0 0,-30 0,0" fill="#c9a13a"/>
    <path d="M0 -30v30" stroke="#8a6a22" stroke-width="1.2" opacity="0.6"/>
  </g>`;
  return svg(w, h, `<ellipse cx="80" cy="130" rx="56" ry="12" fill="#1e2418" opacity="0.22"/>
    ${tent(46, 128, 1.1, "#d8b34a")}${tent(112, 132, 0.9, "#c9a13a")}
    <g transform="translate(80 126)">
      <rect x="-30" y="-20" width="60" height="20" fill="#8a6a3a"/>
      <polygon points="-34,-20 0,-34 34,-20" fill="#a17c42"/>
      <rect x="-8" y="-12" width="16" height="12" fill="#4f3a22"/>
    </g>
    <g transform="translate(80 88)">
      <rect x="-1.5" y="-30" width="3" height="30" fill="#6b5436"/>
      <polygon points="1.5,-30 30,-22 1.5,-12" fill="#e0c04a"/>
      <path d="M8 -24l10 4 -10 4" stroke="#7a5a1e" stroke-width="1.4" fill="none"/>
    </g>
    <path d="M20 128h120" stroke="#5b4a30" stroke-width="2" opacity="0.5"/>`);
}

function resourceSprite(kind) {
  const w = 64, h = 64;
  const shadow = `<ellipse cx="32" cy="56" rx="20" ry="5" fill="#1e2418" opacity="0.22"/>`;
  if (kind === "farm") {
    return svg(w, h, `${shadow}
      <path d="M32 52V30" stroke="#8a6a2e" stroke-width="2"/>
      <path d="M32 34q-12 -6 -16 -16M32 36q12 -6 16 -16M32 42q-10 -4 -14 -12M32 44q10 -4 14 -12" stroke="#d9a93f" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="16" cy="16" r="3" fill="#e6c257"/><circle cx="48" cy="16" r="3" fill="#e6c257"/>
      <circle cx="18" cy="28" r="2.5" fill="#e6c257"/><circle cx="46" cy="28" r="2.5" fill="#e6c257"/>`);
  }
  if (kind === "lumber") {
    return svg(w, h, `${shadow}
      <g transform="translate(32 40)">
        <rect x="-18" y="-4" width="36" height="10" rx="3" fill="#8a5f34"/>
        <rect x="-14" y="-12" width="30" height="9" rx="3" fill="#a3733f"/>
        <circle cx="16" cy="1" r="5" fill="#c9a06a"/><circle cx="16" cy="1" r="2" fill="#8a5f34"/>
        <circle cx="16" cy="-7.5" r="4.5" fill="#c9a06a"/><circle cx="16" cy="-7.5" r="1.8" fill="#8a5f34"/>
      </g>`);
  }
  if (kind === "quarry") {
    return svg(w, h, `${shadow}
      <g transform="translate(32 42)">
        <polygon points="-20,8 -10,-8 8,-4 18,8" fill="#9a9a90"/>
        <polygon points="-10,-8 0,-16 12,-12 8,-4" fill="#b8b8ae"/>
        <polygon points="-4,8 4,-2 14,2 12,8" fill="#83837a"/>
      </g>`);
  }
  return svg(w, h, `${shadow}
    <g transform="translate(32 42)">
      <polygon points="-18,6 -8,-8 10,-6 18,6" fill="#6d6f72"/>
      <polygon points="-8,-8 2,-14 12,-10 10,-6" fill="#8a8c8e"/>
      <circle cx="-6" cy="0" r="2.2" fill="#c9a84a"/><circle cx="4" cy="2" r="1.8" fill="#c9a84a"/>
      <circle cx="6" cy="-4" r="1.5" fill="#e0c46a"/>
    </g>`);
}

function flagSprite(color, dark) {
  const w = 48, h = 88;
  return svg(w, h, `
    <ellipse cx="15" cy="80" rx="10" ry="4" fill="#1e2418" opacity="0.22"/>
    <rect x="14" y="8" width="3" height="72" fill="#6b5436"/>
    <rect x="11" y="78" width="9" height="4" rx="2" fill="#8d7a58"/>
    <path d="M17 10h24l-5 9 5 9H17z" fill="${color}"/>
    <path d="M17 10h24l-5 9H17z" fill="${dark}" opacity="0.55"/>
    <circle cx="30" cy="19" r="2.5" fill="#f3e6c2" opacity="0.85"/>`);
}

function marchSprite(returning) {
  const w = 48, h = 48;
  if (returning) {
    return svg(w, h, `
      <ellipse cx="24" cy="42" rx="14" ry="4" fill="#1e2418" opacity="0.24"/>
      <circle cx="22" cy="14" r="5" fill="#e0c9a4"/>
      <path d="M18 12q4 -6 8 0" stroke="#7a5a30" stroke-width="2" fill="none"/>
      <rect x="17" y="19" width="10" height="13" rx="3" fill="#7d8a5a"/>
      <rect x="14" y="20" width="5" height="9" rx="2" fill="#a58a5a"/>
      <path d="M20 32l-3 9M25 32l3 9" stroke="#4f3a22" stroke-width="3" stroke-linecap="round"/>
      <path d="M29 16l6 12" stroke="#8a6a3a" stroke-width="2" stroke-linecap="round"/>
      <circle cx="36" cy="30" r="2" fill="#d9c49a" opacity="0.8"/>`);
  }
  return svg(w, h, `
    <ellipse cx="24" cy="42" rx="14" ry="4" fill="#1e2418" opacity="0.24"/>
    <circle cx="23" cy="13" r="5" fill="#e0c9a4"/>
    <path d="M18 11q5 -7 10 0" fill="#8a8f96"/>
    <path d="M18 11h10" stroke="#5f646b" stroke-width="2"/>
    <rect x="18" y="18" width="10" height="14" rx="3" fill="#8a4a3c"/>
    <path d="M18 20h-5v8" stroke="#7a3f33" stroke-width="4" stroke-linecap="round"/>
    <path d="M21 32l-3 9M26 32l3 9" stroke="#4f3a22" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 34L38 12" stroke="#8a6a3a" stroke-width="2" stroke-linecap="round"/>
    <polygon points="38,12 34,15 40,16" fill="#c9c9c4"/>`);
}

async function main() {
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const shots = [];
  async function shoot(name, markup, w, h) {
    for (const scale of [1, 2]) {
      const context = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: scale,
      });
      const page = await context.newPage();
      await page.setContent(
        `<style>html,body{margin:0;background:transparent;width:${w}px;height:${h}px;overflow:hidden}svg{display:block}</style>${markup}`,
        { waitUntil: "load" },
      );
      const file = path.join(OUT, `${scale}x`, "world", `${name}.png`);
      await mkdir(path.dirname(file), { recursive: true });
      const buffer = await page.screenshot({
        omitBackground: true,
        clip: { x: 0, y: 0, width: w, height: h },
      });
      await writeFile(file, buffer);
      shots.push({ name, scale, w: w * scale, h: h * scale });
      await context.close();
    }
  }

  for (const [terrain, spec] of Object.entries(TILES)) {
    await shoot(`tile_${terrain}`, svg(TILE_W, TILE_H, spec.body, spec.defs), TILE_W, TILE_H);
  }
  await shoot("city_village", citySprite("village"), 192, 160);
  await shoot("city_town", citySprite("town"), 192, 160);
  await shoot("city_capital", citySprite("capital"), 192, 160);
  await shoot("huangjin", huangjinSprite(), 160, 144);
  for (const kind of ["farm", "lumber", "quarry", "iron"]) {
    await shoot(`resource_${kind}`, resourceSprite(kind), 64, 64);
  }
  await shoot("flag_self", flagSprite("#3f8a5a", "#2d6a44"), 48, 88);
  await shoot("flag_ally", flagSprite("#3f6f9a", "#2d5476"), 48, 88);
  await shoot("flag_neutral", flagSprite("#8d8a7c", "#6f6c60"), 48, 88);
  await shoot("flag_enemy", flagSprite("#a84a3f", "#82342c"), 48, 88);
  await shoot("march_troop", marchSprite(false), 48, 48);
  await shoot("march_returning", marchSprite(true), 48, 48);

  await browser.close();
  console.log(JSON.stringify({ count: shots.length, shots }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
