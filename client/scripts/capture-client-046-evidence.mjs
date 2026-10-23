/**
 * CLIENT-046: center panels (queue / mail / daily chain 400 / bag) art evidence.
 * Usage: node scripts/capture-client-046-evidence.mjs
 * Requires: playwright, mock gateway, vite dev (script spawns both).
 */
import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/client-046");

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19091);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16203);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const TIP_SHA = process.env.EVIDENCE_TIP_SHA || "";

async function waitForHttp(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function setEvidencePreset(preset) {
  const res = await fetch(`${MOCK_HTTP}/_evidence/preset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preset }),
  });
  if (!res.ok) throw new Error(`preset ${preset} failed: ${res.status}`);
}

async function enterMainCity(page) {
  await page.goto(`http://127.0.0.1:${APP_PORT}/`);
  await page.waitForSelector("#hud", { timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById("hud")?.textContent?.includes("加载资源"), {
    timeout: 25000,
  });
  await page.locator(".server-list li").first().click();
  await page.locator('[data-action="enter-game"]').click();
  await page.waitForFunction(
    () => document.getElementById("hud")?.textContent?.includes("art"),
    { timeout: 25000 },
  );
}

const panelLocators = {
  queue: '.content-panel:has([data-action="refresh-queue"])',
  mail: ".mail-inbox-panel",
  daily: '.content-panel:has([data-action="refresh-daily"])',
  bag: '.content-panel:has([data-action="refresh-bag"])',
};

async function openPanel(page, which) {
  const map = {
    queue: "toggle-queue",
    mail: "toggle-mail",
    daily: "toggle-daily",
    bag: "toggle-bag",
  };
  await page.locator(`[data-action="${map[which]}"]`).click();
  await page.waitForSelector(`${panelLocators[which]}:not(.hidden)`, { timeout: 8000 });
}

async function shotPanel(page, which, filePath, quality = 86) {
  const panel = page.locator(panelLocators[which]);
  await panel.waitFor({ state: "visible" });
  const box = await panel.boundingBox();
  if (!box) throw new Error(`panel box missing: ${which}`);
  const pad = 10;
  await page.screenshot({
    path: filePath,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
    type: "jpeg",
    quality,
  });
  const { size } = await stat(filePath);
  if (size >= 1_000_000) {
    throw new Error(`${path.basename(filePath)} is ${size} bytes (must be <1MB)`);
  }
  return size;
}

async function shotButtonStates(page, selector, baseName, inventory, viewportLabel) {
  const btn = page.locator(selector).first();
  await btn.waitFor({ state: "visible" });
  const box = await btn.boundingBox();
  if (!box) throw new Error(`button box missing: ${selector}`);
  const pad = 6;
  const clip = () => ({
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: Math.min(220, box.width + pad * 2),
    height: Math.min(72, box.height + pad * 2),
  });
  for (const [suffix, action] of [
    ["normal", async () => {}],
    ["hover", async () => btn.hover()],
    ["pressed", async () => btn.dispatchEvent("mousedown")],
  ]) {
    await action();
    await page.waitForTimeout(100);
    const file = `${baseName}-${suffix}.jpg`;
    const filePath = path.join(outDir, file);
    await page.screenshot({ path: filePath, clip: clip(), type: "jpeg", quality: 88 });
    const { size } = await stat(filePath);
    if (size >= 1_000_000) throw new Error(`${file} too large`);
    inventory.push({
      path: `docs/art/samples/client-046/${file}`,
      bytes: size,
      viewport: viewportLabel,
      panel: "queue",
      state: `refresh-button-${suffix}`,
      note: "刷新内政按钮态（拼图审阅）",
    });
    if (suffix === "pressed") await btn.dispatchEvent("mouseup");
  }
}

/**
 * @typedef {{ id: string, panel: string, state: string, preset: string, viewport: { w: number, h: number, dpr: number }, setup?: (page: import('playwright').Page) => Promise<void> }} Shot
 */
const shots = [
  {
    id: "queue-empty",
    panel: "queue",
    state: "empty",
    preset: "queue-empty",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "queue");
      await page.locator('[data-action="refresh-queue"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "queue-empty-1280",
    panel: "queue",
    state: "empty",
    preset: "queue-empty",
    viewport: { w: 1280, h: 720, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "queue");
    },
  },
  {
    id: "queue-build-rows",
    panel: "queue",
    state: "build-upgrade-rows",
    preset: "queue-build",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "queue");
    },
  },
  {
    id: "queue-recruit-row",
    panel: "queue",
    state: "recruit-row",
    preset: "queue-recruit",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await page.locator('[data-action="toggle-military"]').click();
      await page.locator('.military-panel [data-action="recruit"]').click();
      await page.waitForTimeout(500);
      await openPanel(page, "queue");
    },
  },
  {
    id: "queue-build-dpr2",
    panel: "queue",
    state: "build-upgrade-rows",
    preset: "queue-build",
    viewport: { w: 1600, h: 900, dpr: 2 },
    setup: async (page) => {
      await openPanel(page, "queue");
    },
  },
  {
    id: "mail-empty-all",
    panel: "mail",
    state: "empty-all-filter",
    preset: "mail-empty",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "mail");
      await page.locator('[data-action="refresh-mail"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "mail-empty-unread",
    panel: "mail",
    state: "empty-unread-filter",
    preset: "mail-empty-unread",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "mail");
      await page.locator('[data-action="mail-filter-unread"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "mail-unread-list",
    panel: "mail",
    state: "unread-list",
    preset: "mail-unread-multi",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "mail");
      await page.locator('[data-action="refresh-mail"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "mail-unread-list-dpr2",
    panel: "mail",
    state: "unread-list",
    preset: "mail-unread-multi",
    viewport: { w: 1600, h: 900, dpr: 2 },
    setup: async (page) => {
      await openPanel(page, "mail");
      await page.locator('[data-action="refresh-mail"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "mail-selected-claim",
    panel: "mail",
    state: "selected-detail-claim-visible",
    preset: "mail-unread-multi",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "mail");
      await page.locator('[data-action="refresh-mail"]').click();
      await page.waitForTimeout(300);
      await page.locator('.mail-list [data-mail-id="6001"]').click();
      await page.waitForTimeout(300);
    },
  },
  {
    id: "mail-selected-no-claim",
    panel: "mail",
    state: "selected-detail-claim-hidden",
    preset: "mail-read-no-claim",
    viewport: { w: 1280, h: 720, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "mail");
      await page.locator('[data-action="refresh-mail"]').click();
      await page.waitForTimeout(300);
      await page.locator('.mail-list [data-mail-id="6200"]').click();
      await page.waitForTimeout(300);
    },
  },
  {
    id: "daily-empty",
    panel: "daily",
    state: "empty-list",
    preset: "daily-empty",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "daily");
      await page.locator('[data-action="refresh-daily"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "daily-items-selected",
    panel: "daily",
    state: "items-and-selected",
    preset: "default",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "daily");
      await page.locator('[data-action="refresh-daily"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "daily-after-accept",
    panel: "daily",
    state: "after-accept",
    preset: "default",
    viewport: { w: 1280, h: 720, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "daily");
      await page.locator('[data-action="refresh-daily"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-action="accept-daily"]').click();
      await page.waitForTimeout(500);
    },
  },
  {
    id: "daily-after-claim",
    panel: "daily",
    state: "after-claim",
    preset: "daily-claimed",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "daily");
      await page.locator('[data-action="refresh-daily"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "bag-empty",
    panel: "bag",
    state: "empty",
    preset: "bag-empty",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "bag");
      await page.locator('[data-action="refresh-bag"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "bag-stacks",
    panel: "bag",
    state: "stacks",
    preset: "bag-stacks",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "bag");
      await page.locator('[data-action="refresh-bag"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "bag-stacks-dpr2",
    panel: "bag",
    state: "stacks",
    preset: "bag-stacks",
    viewport: { w: 1600, h: 900, dpr: 2 },
    setup: async (page) => {
      await openPanel(page, "bag");
      await page.locator('[data-action="refresh-bag"]').click();
      await page.waitForTimeout(400);
    },
  },
  {
    id: "bag-use-success",
    panel: "bag",
    state: "use-success-feedback",
    preset: "bag-stacks",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "bag");
      await page.locator('[data-action="refresh-bag"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-field="item-id"]').selectOption("2001");
      await page.locator('[data-action="use-item"]').click();
      await page.waitForTimeout(500);
    },
  },
  {
    id: "bag-use-fail",
    panel: "bag",
    state: "use-fail-feedback",
    preset: "bag-use-fail",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "bag");
      await page.locator('[data-action="refresh-bag"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-field="use-count"]').fill("9");
      await page.locator('[data-action="use-item"]').click();
      await page.waitForTimeout(500);
    },
  },
];

function viewportLabel(v) {
  return `${v.w}×${v.h} DPR${v.dpr}`;
}

async function resolveTipSha() {
  if (TIP_SHA) return TIP_SHA;
  const { execSync } = await import("node:child_process");
  return execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
}

async function writeInventory(rows, tipSha) {
  const lines = [
    "# CLIENT-046 中心四面板证据索引",
    "",
    "皮肤：`ui.panel.default.v1` + `ui.button.primary.v1`（与军事 `ui.panel.military.v1` 无关）。**不**将 CLIENT-040 军事 PASS 扩展为本目录四面板。",
    "",
    `| 证据 tip SHA | \`${tipSha}\` |`,
    "|---|---|",
    "",
    "| 路径 | 字节 | 视口 | 面板 | 状态 |",
    "|---|---:|---|---|---|",
  ];
  for (const r of rows) {
    lines.push(`| \`${r.path}\` | ${r.bytes} | ${r.viewport} | ${r.panel} | ${r.state} |`);
  }
  lines.push(
    "",
    "## 缺口 / 说明",
    "",
    "- 队列「建造+募兵同框」：本包分 `queue-build-rows` 与 `queue-recruit-row` 两张独立证据；未做单帧合成。",
    "- 日常「领奖中」动效：以 `daily-after-claim`（state=4 已领奖）静态帧代替领奖点击瞬间。",
    "- 复现：`cd client && npm install && npx playwright install chromium && node scripts/capture-client-046-evidence.mjs`",
    "",
  );
  await writeFile(path.join(outDir, "INVENTORY.md"), lines.join("\n"));
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const mock = spawn("node", ["mock-server/server.mjs"], {
    cwd: clientRoot,
    stdio: "inherit",
    env: { ...process.env, MOCK_GATEWAY_PORT: String(MOCK_PORT) },
  });
  const preview = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"],
    {
      cwd: clientRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_GATEWAY_WS_URL: `ws://127.0.0.1:${MOCK_PORT}/ws`,
      },
    },
  );
  const inventory = [];
  try {
    await new Promise((r) => setTimeout(r, 2000));
    await waitForHttp(`http://127.0.0.1:${APP_PORT}/`);
    await waitForHttp(`${MOCK_HTTP}/`);

    const browser = await chromium.launch();
    for (const shot of shots) {
      await setEvidencePreset(shot.preset);
      const context = await browser.newContext({
        viewport: { width: shot.viewport.w, height: shot.viewport.h },
        deviceScaleFactor: shot.viewport.dpr,
      });
      const page = await context.newPage();
      await enterMainCity(page);
      await page.waitForTimeout(500);
      await shot.setup(page);
      const file = `${shot.id}.jpg`;
      const bytes = await shotPanel(page, shot.panel, path.join(outDir, file));
      inventory.push({
        path: `docs/art/samples/client-046/${file}`,
        bytes,
        viewport: viewportLabel(shot.viewport),
        panel: shot.panel,
        state: shot.state,
      });
      await context.close();
    }

    await setEvidencePreset("queue-build");
    const ctxBtn = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });
    const pageBtn = await ctxBtn.newPage();
    await enterMainCity(pageBtn);
    await openPanel(pageBtn, "queue");
    await shotButtonStates(
      pageBtn,
      '[data-action="refresh-queue"]',
      "queue-refresh-btn",
      inventory,
      "1600×900 DPR1",
    );
    await ctxBtn.close();

    await browser.close();
    const tipSha = await resolveTipSha();
    await writeInventory(inventory, tipSha);
    console.log(`Evidence written to ${outDir} (tip ${tipSha})`);
  } finally {
    mock.kill("SIGTERM");
    preview.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
