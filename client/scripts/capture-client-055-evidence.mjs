/**
 * CLIENT-055: center four panels — primary full size, paper text, evidence framing.
 * Usage: node scripts/capture-client-055-evidence.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(clientRoot, "..");
const outDir = path.resolve(repoRoot, "docs/art/samples/client-055");
const SAMPLE_PREFIX = "docs/art/samples/client-055";

const MOCK_PORT = Number(process.env.MOCK_GATEWAY_PORT || 19092);
const APP_PORT = Number(process.env.CLIENT_EVIDENCE_PORT || 16204);
const MOCK_HTTP = `http://127.0.0.1:${MOCK_PORT}`;
const TIP_SHA = process.env.EVIDENCE_TIP_SHA || "";

const panelLocators = {
  queue: '[data-center-panel="queue"]',
  mail: '[data-center-panel="mail"]',
  daily: '[data-center-panel="daily"]',
  bag: '[data-center-panel="bag"]',
};

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

async function shotPanelElement(page, which, filePath, quality = 86) {
  const panel = page.locator(panelLocators[which]);
  await panel.waitFor({ state: "visible" });
  await panel.evaluate((el) => {
    el.scrollTop = 0;
    el.scrollLeft = 0;
  });
  await page.waitForTimeout(120);
  await panel.screenshot({ path: filePath, type: "jpeg", quality });
  const { size } = await stat(filePath);
  if (size >= 1_000_000) {
    throw new Error(`${path.basename(filePath)} is ${size} bytes (must be <1MB)`);
  }
  return size;
}

async function shotRegionLocator(locator, filePath, quality = 88) {
  await locator.waitFor({ state: "visible" });
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((el) => {
    if (el instanceof HTMLElement) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  });
  await locator.page().waitForTimeout(120);
  await locator.screenshot({ path: filePath, type: "jpeg", quality });
  const { size } = await stat(filePath);
  if (size >= 1_000_000) throw new Error(`${path.basename(filePath)} too large`);
  return size;
}

async function readButtonMetrics(page, selector) {
  return page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      width: cs.width,
      height: cs.height,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    };
  });
}

async function shotButtonStates(page, selector, baseName, inventory, viewportLabel, panelName) {
  const btn = page.locator(selector).first();
  await btn.waitFor({ state: "visible" });
  await btn.scrollIntoViewIfNeeded();
  const metricsNormal = await readButtonMetrics(page, selector);
  const pad = 8;
  for (const [suffix, action] of [
    [
      "normal",
      async () => {
        await page.mouse.move(0, 0);
        await btn.evaluate((el) => {
          el.disabled = false;
        });
      },
    ],
    ["hover", async () => btn.hover()],
    [
      "pressed",
      async () => {
        await btn.hover();
        await btn.dispatchEvent("mousedown");
      },
    ],
    [
      "disabled",
      async () => {
        await page.mouse.move(0, 0);
        await btn.evaluate((el) => {
          el.disabled = true;
        });
      },
    ],
  ]) {
    await action();
    await page.waitForTimeout(180);
    const file = `${baseName}-${suffix}.jpg`;
    const filePath = path.join(outDir, file);
    const clipLocator = btn;
    await clipLocator.screenshot({ path: filePath, type: "jpeg", quality: 88 });
    const { size } = await stat(filePath);
    if (size >= 1_000_000) throw new Error(`${file} too large`);
    const m =
      suffix === "normal"
        ? metricsNormal
        : suffix === "disabled"
          ? await readButtonMetrics(page, selector)
          : metricsNormal;
    inventory.push({
      path: `${SAMPLE_PREFIX}/${file}`,
      bytes: size,
      viewport: viewportLabel,
      panel: panelName,
      state: `button-${suffix}`,
      note: `computed ${m.width}×${m.height} (client ${m.clientWidth}×${m.clientHeight})`,
    });
    if (suffix === "pressed") await btn.dispatchEvent("mouseup");
  }
  await btn.evaluate((el) => {
    el.disabled = false;
  });
}

/** @type {import('playwright').Page} */
const shots = [
  {
    id: "queue-representative-1600-dpr1",
    panel: "queue",
    state: "representative-center-panel",
    preset: "queue-build",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "queue");
    },
  },
  {
    id: "queue-representative-1600-dpr2",
    panel: "queue",
    state: "representative-center-panel",
    preset: "queue-build",
    viewport: { w: 1600, h: 900, dpr: 2 },
    setup: async (page) => {
      await openPanel(page, "queue");
    },
  },
  {
    id: "queue-representative-1280",
    panel: "queue",
    state: "representative-center-panel",
    preset: "queue-build",
    viewport: { w: 1280, h: 720, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "queue");
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
      await page.waitForSelector('[data-action="claim-mail"]:not(.hidden)', { timeout: 8000 });
      await page.waitForTimeout(400);
    },
  },
  {
    id: "mail-selected-no-claim",
    panel: "mail",
    state: "selected-detail-claim-hidden",
    preset: "mail-read-no-claim",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "mail");
      await page.locator('[data-action="refresh-mail"]').click();
      await page.waitForSelector('[data-role="mail-body"]', { timeout: 8000 });
      await page.waitForSelector('[data-action="claim-mail"].hidden', { state: "attached", timeout: 8000 });
      await page.waitForTimeout(400);
    },
  },
  {
    id: "mail-list-error",
    panel: "mail",
    state: "inbox-load-error",
    preset: "mail-list-error",
    viewport: { w: 1600, h: 900, dpr: 1 },
    setup: async (page) => {
      await openPanel(page, "mail");
      await page.locator('[data-action="refresh-mail"]').click();
      await page.waitForTimeout(500);
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
    "# CLIENT-055 中心四面板证据索引",
    "",
    "CLIENT-054 美术 FAIL 余项：primary 160×48 完整接线、纸底漏网字色、代表截图/按钮 bounding box 重拍。",
    "",
    `| 证据 tip SHA | \`${tipSha}\` |`,
    "|---|---|",
    "",
    "| 路径 | 字节 | 视口 | 面板 | 状态 | 备注 |",
    "|---|---:|---|---|---|---|",
  ];
  for (const r of rows) {
    const note = r.note ? r.note : "";
    lines.push(
      `| \`${r.path}\` | ${r.bytes} | ${r.viewport} | ${r.panel} | ${r.state} | ${note} |`,
    );
  }
  lines.push(
    "",
    "## 复现",
    "",
    "```bash",
    "cd client && npm install && npx playwright install chromium && node scripts/capture-client-055-evidence.mjs",
    "```",
    "",
  );
  await writeFile(path.join(outDir, "INVENTORY.md"), lines.join("\n"));
  await writeFile(
    path.join(outDir, "README.md"),
    `# CLIENT-055 中心四面板 FAIL 余项证据

队列 / 邮件 / 日常 / 背包 — primary 完整尺寸、纸底字色漏网、截图 framing 修正。

索引见 [\`INVENTORY.md\`](./INVENTORY.md)（含证据 tip SHA）。

\`\`\`bash
cd client && npm install && npx playwright install chromium && node scripts/capture-client-055-evidence.mjs
\`\`\`
`,
  );
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
      const bytes = await shotPanelElement(page, shot.panel, path.join(outDir, file));
      inventory.push({
        path: `${SAMPLE_PREFIX}/${file}`,
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
      '[data-center-panel="queue"] [data-action="refresh-queue"]',
      "queue-refresh-btn",
      inventory,
      "1600×900 DPR1",
      "queue",
    );
    await ctxBtn.close();

    const actionShots = [
      {
        id: "mail-toolbar-actions",
        panel: "mail",
        preset: "mail-unread-multi",
        selector: '[data-center-panel="mail"] .mail-inbox-toolbar',
        state: "mail-filter-and-refresh-primary",
      },
      {
        id: "daily-toolbar-actions",
        panel: "daily",
        preset: "default",
        selector: '[data-center-panel="daily"] .content-panel-actions',
        state: "daily-refresh-accept-claim-primary",
      },
      {
        id: "bag-toolbar-actions",
        panel: "bag",
        preset: "bag-stacks",
        selector: '[data-center-panel="bag"] .content-panel-actions',
        state: "bag-refresh-use-primary",
      },
    ];

    for (const shot of actionShots) {
      await setEvidencePreset(shot.preset);
      const context = await browser.newContext({
        viewport: { width: 1600, height: 900 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await enterMainCity(page);
      if (shot.panel === "mail") {
        await openPanel(page, "mail");
        await page.locator('[data-action="refresh-mail"]').click();
        await page.waitForTimeout(400);
      } else if (shot.panel === "daily") {
        await openPanel(page, "daily");
        await page.locator('[data-action="refresh-daily"]').click();
        await page.waitForTimeout(400);
      } else {
        await openPanel(page, "bag");
        await page.locator('[data-action="refresh-bag"]').click();
        await page.waitForTimeout(400);
      }
      const bytes = await shotRegionLocator(page.locator(shot.selector), path.join(outDir, `${shot.id}.jpg`));
      const metricNote = await page
        .locator(`${shot.selector} button.art-btn-primary-full`)
        .first()
        .evaluate((el) => {
          const cs = getComputedStyle(el);
          return `first primary computed ${cs.width}×${cs.height}`;
        })
        .catch(() => "");
      inventory.push({
        path: `${SAMPLE_PREFIX}/${shot.id}.jpg`,
        bytes,
        viewport: "1600×900 DPR1",
        panel: shot.panel,
        state: shot.state,
        note: metricNote,
      });
      await context.close();
    }

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
